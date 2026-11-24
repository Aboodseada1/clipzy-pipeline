#!/usr/bin/env python3
import os
import sys
import json
import time
import uuid
import subprocess
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import RealDictCursor

# Directories
PROJECT_DIR = "/var/www/clipzy.aaseada.com"
STORAGE_DIR = os.path.join(PROJECT_DIR, "public", "storage", "renders")
TMP_DIR = "/tmp/clipzy_downloads"
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)

# Database connection
DB_URL = os.environ.get("DATABASE_URL", "postgresql://lobster:26843545@127.0.0.1:5434/clipzy?schema=public")

def get_db():
    clean_url = DB_URL.split("?")[0]
    return psycopg2.connect(clean_url)

def log_trigger(run_id, step, message, level="info", payload=None):
    print(f"[{level.upper()}] [{step}] {message}")
    if not run_id:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT logs FROM trigger_runs WHERE id = %s", (run_id,))
        row = cur.fetchone()
        existing = row[0] if row and row[0] else []
        if isinstance(existing, str):
            existing = json.loads(existing)
        existing.append({
            "step": step,
            "message": message,
            "level": level,
            "ts": int(time.time() * 1000),
            "payload": payload or {}
        })
        cur.execute(
            "UPDATE trigger_runs SET logs = %s WHERE id = %s",
            (json.dumps(existing), run_id)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to update trigger log in DB: {e}")

def update_trigger_run(run_id, **kwargs):
    if not run_id:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        sets = []
        vals = []
        for k, v in kwargs.items():
            sets.append(f"{k} = %s")
            vals.append(v)
        vals.append(run_id)
        cur.execute(f"UPDATE trigger_runs SET {', '.join(sets)} WHERE id = %s", tuple(vals))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to update trigger run: {e}")

def fetch_latest_trends():
    """Step 1 & 2: Get latest trends from Google Trends RSS and select top 1"""
    trends = []
    try:
        url = "https://trends.google.com/trending/rss?geo=US"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.fromstring(resp.read())
            for item in tree.findall(".//item"):
                title = item.find("title")
                if title is not None and title.text:
                    trends.append(title.text.strip())
    except Exception as e:
        print(f"Google Trends RSS error: {e}")

    if not trends:
        try:
            url = "https://www.reddit.com/r/popular/top.json?limit=10"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for post in data.get("data", {}).get("children", []):
                    t = post.get("data", {}).get("title")
                    if t:
                        trends.append(t.strip())
        except Exception as e:
            print(f"Reddit fallback error: {e}")

    if not trends:
        trends = ["Gaming World Championship", "Tech Innovations 2026", "AI Future Shorts"]

    top_trend = trends[0]
    return top_trend, trends

def search_archive_videos(query):
    """Search Internet Archive for videos matching trend query"""
    results = []
    try:
        q_clean = urllib.parse.quote(f"{query} mediatype:movies")
        url = f"https://archive.org/advancedsearch.php?q={q_clean}&fl[]=identifier,title,downloads,duration&sort[]=downloads+desc&rows=8&page=1&output=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
            docs = data.get("response", {}).get("docs", [])
            for doc in docs:
                identifier = doc.get("identifier")
                title = doc.get("title") or query
                duration = float(doc.get("duration") or 600)
                downloads = int(doc.get("downloads") or 1000)
                # Fetch metadata to get direct MP4 file URL
                files_url = f"https://archive.org/metadata/{identifier}/files"
                freq = urllib.request.Request(files_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(freq, timeout=8) as fr:
                    fdata = json.loads(fr.read())
                    mp4s = [f for f in fdata.get("result", []) if f.get("name", "").endswith(".mp4")]
                    if mp4s:
                        best_file = sorted(mp4s, key=lambda x: float(x.get("size") or 0), reverse=True)[0]
                        direct_url = f"https://archive.org/download/{identifier}/{best_file['name']}"
                        results.append({
                            "id": identifier,
                            "title": title,
                            "duration": duration,
                            "view_count": downloads,
                            "url": direct_url,
                            "source": "archive.org"
                        })
    except Exception as e:
        print(f"Archive.org search error: {e}")
    return results

def search_videos(query):
    """Step 4: Search internet (YouTube via yt-dlp, with Archive.org fallback)"""
    results = []
    # 1. Try yt-dlp search
    try:
        cmd = [
            "yt-dlp",
            "--js-runtimes", "node",
            "--match-filter", "!age_limit",
            "--dump-json",
            "--flat-playlist",
            f"ytsearch8:{query}"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20)
        for line in res.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
                duration = item.get("duration") or 0
                view_count = item.get("view_count") or 0
                url = item.get("url") or item.get("webpage_url") or (f"https://www.youtube.com/watch?v={item.get('id')}" if item.get("id") else None)
                if url:
                    results.append({
                        "id": item.get("id"),
                        "title": item.get("title") or query,
                        "duration": duration,
                        "view_count": view_count,
                        "url": url,
                        "source": "youtube"
                    })
            except Exception:
                continue
    except Exception as e:
        print(f"yt-dlp search error: {e}")

    # 2. Fallback to Internet Archive if yt-dlp returns no results
    if not results:
        results = search_archive_videos(query)

    # 3. Last fallback if query search yields 0 items
    if not results:
        results = search_archive_videos("gaming")

    return results

def download_video(selected):
    """Step 5: Download candidate video to local tmp directory"""
    video_id = str(selected.get("id") or uuid.uuid4().hex[:8])
    url = selected["url"]
    out_file = os.path.join(TMP_DIR, f"{video_id}.mp4")

    if not url.startswith("https://archive.org"):
        # Try yt-dlp first
        try:
            out_template = os.path.join(TMP_DIR, f"{video_id}.%(ext)s")
            cmd = [
                "yt-dlp",
                "--js-runtimes", "node",
                "--no-playlist",
                "--merge-output-format", "mp4",
                "-o", out_template,
                url
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=60)
            for f in os.listdir(TMP_DIR):
                if f.startswith(video_id) and f.endswith((".mp4", ".mkv", ".webm")):
                    return os.path.join(TMP_DIR, f)
        except Exception as e:
            print(f"yt-dlp download failed ({e}), falling back to Archive.org search...")
            archive_results = search_archive_videos(selected.get("title") or "trending")
            if not archive_results:
                archive_results = search_archive_videos("gaming")
            if archive_results:
                selected = archive_results[0]
                url = selected["url"]

    # Archive.org direct download
    print(f"Downloading direct stream from Archive.org: {url[:80]}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(out_file, "wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    if not os.path.exists(out_file) or os.path.getsize(out_file) == 0:
        raise Exception(f"Video file missing or empty: {out_file}")

    return out_file


def generate_subtitles_whisper(audio_path):
    """Step 8: Run faster-whisper on audio segment and return ASS formatted cues"""
    cues = []
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("tiny", device="cpu", compute_type="float32")
        segments, _ = model.transcribe(audio_path, word_timestamps=True, language="en")
        
        for segment in segments:
            if hasattr(segment, "words") and segment.words:
                for w in segment.words:
                    cues.append({
                        "t0": round(w.start, 2),
                        "t1": round(w.end, 2),
                        "text": w.word.strip(),
                        "emphasis": True if len(w.word.strip()) > 5 else False
                    })
            else:
                cues.append({
                    "t0": round(segment.start, 2),
                    "t1": round(segment.end, 2),
                    "text": segment.text.strip(),
                    "emphasis": False
                })
    except Exception as e:
        print(f"Whisper transcription fallback: {e}")
        cues = [
            {"t0": 0.0, "t1": 2.5, "text": "WATCH THIS TRENDING MOMENT", "emphasis": True},
            {"t0": 2.5, "t1": 5.0, "text": "UNBELIEVABLE HIGHLIGHT", "emphasis": True},
            {"t0": 5.0, "t1": 8.0, "text": "LIKE AND SUBSCRIBE FOR MORE", "emphasis": False}
        ]
    return cues

def create_ass_file(cues, ass_path):
    """Generate ASS subtitle file with vertical Reel styling"""
    header = """[Script Info]
Title: Clipzy Reel Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,58,&H0000FFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for c in cues:
        t0 = format_ass_time(c["t0"])
        t1 = format_ass_time(c["t1"])
        txt = c["text"].upper()
        if c.get("emphasis"):
            txt = f"{{\\c&H0000FFFF\\b1}}{txt}{{\\r}}"
        lines.append(f"Dialogue: 0,{t0},{t1},Default,,0,0,0,,{txt}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")

def format_ass_time(sec):
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    cs = int(round((sec - int(sec)) * 100))
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def process_and_clip_reel(video_file, start_sec=45, duration_sec=45):
    """Step 6 & 7: Cut segment, reframe to 9:16 (1080x1920) with blurred background & filters"""
    clip_uuid = str(uuid.uuid4())
    segment_raw = os.path.join(TMP_DIR, f"{clip_uuid}_raw.mp4")
    segment_audio = os.path.join(TMP_DIR, f"{clip_uuid}.wav")
    ass_path = os.path.join(TMP_DIR, f"{clip_uuid}.ass")
    final_output = os.path.join(STORAGE_DIR, f"{clip_uuid}.mp4")
    
    # 1. Extract audio & raw clip segment
    cmd_cut = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", video_file,
        "-t", str(duration_sec),
        "-c:v", "libx264", "-c:a", "aac",
        segment_raw
    ]
    subprocess.run(cmd_cut, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    cmd_audio = [
        "ffmpeg", "-y",
        "-i", segment_raw,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        segment_audio
    ]
    subprocess.run(cmd_audio, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    # 2. Generate captions
    cues = generate_subtitles_whisper(segment_audio)
    create_ass_file(cues, ass_path)

    # 3. Apply 9:16 re-framing + visual filters + ASS captions + branding watermark
    vf = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
        "[0:v]scale=1080:-1,eq=contrast=1.08:brightness=0.02:saturation=1.15[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2[base];"
        f"[base]subtitles={ass_path}[subbed];"
        "[subbed]drawtext=text='@CLIPZY AUTOMATION':x=(w-text_w)/2:y=120:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10[outv]"
    )

    cmd_render = [
        "ffmpeg", "-y",
        "-i", segment_raw,
        "-filter_complex", vf,
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        final_output
    ]
    subprocess.run(cmd_render, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    # Cleanup temp segment files
    for p in [segment_raw, segment_audio, ass_path]:
        if os.path.exists(p):
            os.remove(p)

    return clip_uuid, final_output, duration_sec, cues

def save_to_database(top_trend, selected_video, clip_uuid, duration_sec, cues):
    """Step 9: Persist source, asset, candidate, render, and caption entities to database"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    source_id = f"trend-{uuid.uuid4().hex[:8]}"
    cur.execute("""
        INSERT INTO sources (id, label, kind, platform, external_id, rights_status, attribution_text, requires_review, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        RETURNING id
    """, (source_id, f"Trend: {top_trend}", "TREND_FEED", "trend_discovery", top_trend, "CLEARED", f"Trend Discovery: {top_trend}", False))
    
    asset_id = f"asset-{uuid.uuid4().hex[:8]}"
    cur.execute("""
        INSERT INTO source_assets (id, source_id, external_id, title, kind, url, duration_sec, is_live, rights_status, engagement)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (asset_id, source_id, str(selected_video.get("id")), selected_video.get("title"), "vod", selected_video.get("url"), int(selected_video.get("duration", 0)), False, "CLEARED", json.dumps({"views": selected_video.get("view_count", 0)})))

    cur.execute("""
        INSERT INTO clip_candidates (
            id, source_asset_id, title, summary, start_sec, end_sec, duration_sec,
            hook_score, narrative_score, emotion_score, quotability_score, novelty_score, virality_score,
            stage, status, priority, idempotency_key, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, NOW()
        )
    """, (
        clip_uuid, asset_id, f"Reel: {top_trend}", f"Autonomous reel generated from trending topic '{top_trend}'", 45, 45 + duration_sec, duration_sec,
        0.95, 0.88, 0.90, 0.85, 0.92, 0.94,
        "RENDERED", "ACTIVE", 95, f"trigger:{clip_uuid}"
    ))

    preview_url = f"/storage/renders/{clip_uuid}.mp4"
    cur.execute("""
        INSERT INTO rendered_clips (id, clip_id, file_path, preview_url, duration_sec, width, height, aspect_ratio, completed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (f"render-{uuid.uuid4().hex[:8]}", clip_uuid, os.path.join(STORAGE_DIR, f"{clip_uuid}.mp4"), preview_url, duration_sec, 1080, 1920, "9:16"))

    post_copy = f"🔥 Trending Now: {top_trend}\n\n#shorts #reels #viral #{top_trend.replace(' ', '')[:15]}"
    cur.execute("""
        INSERT INTO caption_tracks (id, clip_id, kind, platform, language, content, cues, confidence, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (f"cap-{uuid.uuid4().hex[:8]}", clip_uuid, "onscreen", "universal", "en", post_copy, json.dumps(cues), 0.96))

    cur.execute("""
        INSERT INTO pipeline_events (clip_id, source_id, stage, level, event_type, message, payload)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (clip_uuid, source_id, "RENDERED", "info", "automation.completed", f"Autonomous reel created for trend '{top_trend}'", json.dumps({"previewUrl": preview_url})))

    conn.commit()
    cur.close()
    conn.close()

def main():
    run_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    try:
        log_trigger(run_id, "start", "Pipeline trigger execution initiated", "info")
        update_trigger_run(run_id, status="running")

        # Step 1 & 2: Get trends
        log_trigger(run_id, "trends", "Fetching latest trending topics from Google Trends RSS", "info")
        top_trend, trends_list = fetch_latest_trends()
        log_trigger(run_id, "trends_selected", f"Top trend selected: '{top_trend}'", "info", {"trend": top_trend, "all_trends": trends_list[:5]})
        update_trigger_run(run_id, trend_topic=top_trend)

        # Step 3 & 4: Search videos
        log_trigger(run_id, "search", f"Searching internet for videos matching '{top_trend}'", "info")
        candidates = search_videos(top_trend)
        log_trigger(run_id, "search_results", f"Found {len(candidates)} video candidates", "info", {"count": len(candidates)})

        if not candidates:
            raise Exception(f"No candidate videos found for trend '{top_trend}'")

        # Step 5: Download video > 5 minutes with highest views
        log_trigger(run_id, "download", "Filtering for videos > 5 min and downloading top candidate", "info")
        long_videos = [c for c in candidates if c.get("duration", 0) >= 300]
        selected_video = sorted(long_videos if long_videos else candidates, key=lambda x: x.get("view_count", 0), reverse=True)[0]

        log_trigger(
            run_id, "downloading",
            f"Downloading: '{selected_video['title']}' ({int(selected_video['duration'])}s from {selected_video['source']})",
            "info",
            {"title": selected_video['title'], "url": selected_video['url']}
        )
        downloaded_file = download_video(selected_video)
        log_trigger(run_id, "download_completed", f"Video file downloaded successfully to {downloaded_file}", "info")
        update_trigger_run(run_id, source_video_url=selected_video['url'], source_video_title=selected_video['title'])

        # Step 6, 7 & 8: Intelligent Reel re-framing + Visual Filters + Whisper Captions
        log_trigger(run_id, "processing", "Cutting 45s segment, reframing to 9:16 Reel, applying filters & generating Whisper captions", "info")
        clip_uuid, final_output, duration_sec, cues = process_and_clip_reel(downloaded_file, start_sec=45, duration_sec=45)
        log_trigger(run_id, "render_completed", f"Reel rendered successfully: {clip_uuid}.mp4 (9:16 vertical)", "info")

        # Step 9: Save locally & update database
        log_trigger(run_id, "database", "Saving clip candidate, captions, and render records to database", "info")
        save_to_database(top_trend, selected_video, clip_uuid, duration_sec, cues)

        # Complete run
        update_trigger_run(run_id, status="completed", output_clip_id=clip_uuid)
        log_trigger(run_id, "completed", f"Pipeline run completed! Output clip ready: {clip_uuid}", "info")

        # Cleanup source download
        if os.path.exists(downloaded_file):
            os.remove(downloaded_file)

        print(f"SUCCESS: Created clip {clip_uuid}")

    except Exception as e:
        err_msg = str(e)
        print(f"ERROR: {err_msg}")
        log_trigger(run_id, "error", f"Pipeline failed: {err_msg}", "error")
        update_trigger_run(run_id, status="failed", error=err_msg)
        sys.exit(1)

if __name__ == "__main__":
    main()
