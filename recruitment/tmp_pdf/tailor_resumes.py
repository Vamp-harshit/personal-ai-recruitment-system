from __future__ import annotations

import collections
import hashlib
import json
import pathlib
import re
import sys

sys.path.insert(0, "USER_HOME/AppData/Local/Temp/recruitment_pdf_tools")
import fitz
import numpy as np

ROOT = pathlib.Path("PROJECT_ROOT")
SOURCE = ROOT / "resume/Harshit_SE_Resume_1YOE.pdf"
OUTPUT = ROOT / "recruitment/tailored_resumes"
QA = ROOT / "recruitment/tmp_pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
FONT_FILES = {"Georgia": "C:/Windows/Fonts/georgia.ttf", "Georgia,Bold": "C:/Windows/Fonts/georgiab.ttf", "Georgia,Italic": "C:/Windows/Fonts/georgiai.ttf"}
FONT_NAMES = {"Georgia": "TailorGeorgia", "Georgia,Bold": "TailorGeorgiaBold", "Georgia,Italic": "TailorGeorgiaItalic"}
FONTS = {name: fitz.Font(fontfile=file) for name, file in FONT_FILES.items()}
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
source_doc = fitz.open(SOURCE)
source_page = source_doc[0]
all_spans = [s for b in source_page.get_text("dict")["blocks"] if "lines" in b for l in b["lines"] for s in l["spans"]]
source_links = sorted(link["uri"] for link in source_page.get_links() if "uri" in link)


def words(text):
    # Compare complete word multiplicities, independent of ordering, punctuation,
    # discretionary hyphens and the source font's private-use bullet character.
    # Georgia's extracted ToUnicode maps its hyphen glyph to a soft hyphen.
    # Normalize that glyph to an ordinary separator, preserving compound words.
    text = text.replace("\u00ad", "-").replace("\uf0b7", " ")
    return collections.Counter(re.findall(r"[A-Za-z0-9]+", text))


def paragraphs(low, high):
    spans = [s for s in all_spans if low <= s["origin"][1] <= high and s["text"].strip()]
    bullets = sorted(s["origin"][1] for s in spans if s["font"] == "Symbol")
    result = [[] for _ in bullets]
    for s in spans:
        candidates = [i for i, y in enumerate(bullets) if s["origin"][1] >= y - 0.01]
        if not candidates:
            raise RuntimeError("A paragraph span precedes its bullet")
        result[candidates[-1]].append(s)
    return result, bullets


TCS, TCS_BASELINES = paragraphs(115.9, 231.0)
PROJECT, PROJECT_BASELINES = paragraphs(361.0, 448.0)
assert len(TCS) == 6 and len(PROJECT) == 4


def reorder_block(page, original_paragraphs, baselines, order, final_boundary):
    source_spans = [s for p in original_paragraphs for s in p]
    rect = fitz.Rect(min(s["bbox"][0] for s in source_spans) - 0.1,
                     min(s["bbox"][1] for s in source_spans) - 0.05,
                     max(s["bbox"][2] for s in source_spans) + 0.1,
                     max(s["bbox"][3] for s in source_spans) + 0.05)
    page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
    pitches = [b-a for a, b in zip(baselines, baselines[1:])] + [final_boundary-baselines[-1]]
    cursor = baselines[0]
    insertions = []
    for i in order:
        delta = cursor - baselines[i]
        for span in original_paragraphs[i]:
            text = "\u2022" if span["font"] == "Symbol" else span["text"]
            font_name = "symb" if span["font"] == "Symbol" else FONT_NAMES[span["font"]]
            full_width = (fitz.Font("symb") if span["font"] == "Symbol" else FONTS[span["font"]]).text_length(text, fontsize=span["size"])
            width_scale = (span["bbox"][2] - span["bbox"][0]) / full_width
            insertions.append({"point": (span["origin"][0], span["origin"][1] + delta),
                               "text": text, "fontname": font_name, "fontsize": span["size"], "width_scale": width_scale})
        cursor += pitches[i]
    assert abs(cursor-final_boundary) < 0.01
    return rect, insertions


def change_skill_value(page, old, new):
    matches = [s for s in all_spans if s["text"] == old]
    assert len(matches) == 1, (old, len(matches))
    span = matches[0]
    rect = fitz.Rect(span["bbox"])
    page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
    return rect, {"point": span["origin"], "text": new,
                  "fontname": FONT_NAMES[span["font"]], "fontsize": span["size"],
                  "width_scale": (span["bbox"][2]-span["bbox"][0]) / FONTS[span["font"]].text_length(old, fontsize=span["size"])}


plans = [
    {
        "company": "REA Group",
        "application_id": "RH-20261125-REA-DATA-PYTHON",
        "job_title": "Engineer - Data Backend - Python",
        "filename": "REA_Group_Engineer_Data_Backend_Python_Resume_2026-11-25.pdf",
        "tcs_order": [4, 3, 2, 1, 5, 0],
        "project_order": None,
        "skill_changes": {
            "Java, Python, C++, JavaScript, SQL": "Python, SQL, Java, C++, JavaScript",
            "Spring Boot, FastAPI, Flask, Node.js, Express.js, REST APIs, Microservices": "FastAPI, Flask, Node.js, Express.js, REST APIs, Microservices, Spring Boot",
            "Qdrant, PostgreSQL, MongoDB, MySQL, Redis": "PostgreSQL, MySQL, Qdrant, MongoDB, Redis",
            "Scrapy, Playwright, ETL workflows, API integration": "Scrapy, ETL workflows, API integration, Playwright",
            "LangChain, LangGraph, LangSmith, HuggingFace, OpenAI API, RAG pipelines, Prompt Engg.": "LangSmith, LangChain, LangGraph, HuggingFace, OpenAI API, RAG pipelines, Prompt Engg."
        },
        "tailoring_summary": ["Led TCS experience with Scrapy data ingestion, Qdrant document retrieval and LangSmith tracing/debugging.", "Moved Python and SQL to the front of the language list; prioritized FastAPI/Flask, PostgreSQL and ETL keywords already in the resume.", "Retained prototype and designed-and-tested qualifications and every original task, metric, title and employment date."],
        "claim_ids_emphasized": ["tcs_07", "tcs_08", "tcs_05", "tcs_06", "tcs_04", "waahads_01", "waahads_02"],
        "listed_skills_emphasized": ["Python", "SQL", "FastAPI", "Flask", "ETL workflows"],
        "gaps_not_claimed": ["Airflow", "Kafka", "Terraform", "CI/CD ownership", "large-scale analytical data platform ownership"]
    },
    {
        "company": "Zynkrow",
        "application_id": "RH-20261125-ZYNKROW-NODE",
        "job_title": "Backend Developer (Node.js)",
        "filename": "Zynkrow_Backend_Developer_Nodejs_Resume_2026-11-25.pdf",
        "tcs_order": [1, 4, 5, 2, 0, 3],
        "project_order": [0, 3, 1, 2],
        "skill_changes": {
            "Java, Python, C++, JavaScript, SQL": "JavaScript, Python, SQL, Java, C++",
            "Spring Boot, FastAPI, Flask, Node.js, Express.js, REST APIs, Microservices": "Node.js, Express.js, REST APIs, Microservices, FastAPI, Flask, Spring Boot",
            "Qdrant, PostgreSQL, MongoDB, MySQL, Redis": "MongoDB, PostgreSQL, MySQL, Redis, Qdrant"
        },
        "tailoring_summary": ["Prioritized caching, Scrapy and sitemap automation within TCS experience.", "Moved the Code-Collab Express.js capacity bullet directly after the project overview, followed by Socket.io collaboration.", "Prioritized existing JavaScript, Node.js, Express.js, REST APIs and MongoDB skills; retained React project evidence and WaahAds backend employment."],
        "claim_ids_emphasized": ["waahads_01", "waahads_02", "project_01", "project_02", "project_03", "project_05", "project_06", "tcs_02", "tcs_03"],
        "listed_skills_emphasized": ["REST APIs", "MongoDB"],
        "gaps_not_claimed": ["TypeScript", "React Native", "testing-framework ownership", "CI/CD ownership"]
    }
]


source_text = source_page.get_text(sort=True)
source_word_counts = words(source_text)
source_pixels = np.frombuffer(source_page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).samples, dtype=np.uint8).reshape(1584, 1224, 3)
source_page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False).save(QA / "master_reference.png")
manifest = []

for plan in plans:
    document = fitz.open(SOURCE)
    page = document[0]
    masks = []
    insertions = []
    rect, block_insertions = reorder_block(page, TCS, TCS_BASELINES, plan["tcs_order"], 243.67)
    masks.append(rect)
    insertions.extend(block_insertions)
    if plan["project_order"] is not None:
        rect, block_insertions = reorder_block(page, PROJECT, PROJECT_BASELINES, plan["project_order"], 461.0)
        masks.append(rect)
        insertions.extend(block_insertions)
    for old, new in plan["skill_changes"].items():
        rect, insertion = change_skill_value(page, old, new)
        masks.append(rect)
        insertions.append(insertion)
    page.apply_redactions(images=0, graphics=0, text=0)
    for original_name, fontfile in FONT_FILES.items():
        page.insert_font(fontname=FONT_NAMES[original_name], fontfile=fontfile)
    for insertion in insertions:
        width_scale = insertion.pop("width_scale")
        page.insert_text(**insertion, color=(0, 0, 0), overlay=True,
                         morph=(fitz.Point(insertion["point"]), fitz.Matrix(width_scale, 1)))
    path = OUTPUT / plan["filename"]
    document.save(path, garbage=4, deflate=True, clean=True)
    document.close()
    result = fitz.open(path)
    text = result[0].get_text(sort=True)
    actual = words(text)
    if actual != source_word_counts:
        raise RuntimeError({"file": plan["filename"], "missing_words": dict(source_word_counts-actual), "extra_words": dict(actual-source_word_counts)})
    links = sorted(link["uri"] for link in result[0].get_links() if "uri" in link)
    assert links == source_links
    assert len(result) == 1
    assert all(term in text for term in ["Harshit", "Kumar", "contact@example.invalid", "[PHONE_REDACTED]", "System Engineer (AI Cloud)", "Software Engineer", "June 2025", "July 2024", "May 2025", "prototypes", "Designed and tested"])
    pixmap = result[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixels = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(1584, 1224, 3)
    outside = np.ones(pixels.shape[:2], dtype=bool)
    for r in masks:
        # Two pixels of extra allowance include the edge antialiasing of changed spans.
        x0, y0, x1, y1 = [int(round(v * 2)) for v in r]
        outside[max(0, y0-2):min(1584, y1+2), max(0, x0-2):min(1224, x1+2)] = False
    outside_difference = int(np.count_nonzero(np.any(source_pixels != pixels, axis=2) & outside))
    if outside_difference:
        raise RuntimeError({"file": plan["filename"], "outside_changed_region_pixels": outside_difference})
    render = QA / (path.stem + ".png")
    result[0].get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False).save(render)
    (QA / (path.stem + ".txt")).write_text(text, encoding="utf-8")
    record = {key: value for key, value in plan.items() if key not in ["tcs_order", "project_order", "skill_changes"]}
    record.update({"file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size,
                   "source_sha256": source_hash, "page_count": 1, "render": str(render), "source_word_multiplicities_preserved": True,
                   "links_preserved": True, "unique_link_count": len(links), "outside_changed_region_pixel_difference": outside_difference,
                   "hidden_duplicate_text_check": "Complete extracted word multiplicities equal source; no clipped source-page copies used.",
                   "status": "prepared; submission holds unchanged; awaiting visual inspection"})
    manifest.append(record)
    result.close()

assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
(OUTPUT / "tailoring_manifest_2026-11-25.json").write_text(json.dumps({"created_on": "2026-11-25", "source_unchanged": True, "resumes": manifest}, indent=2), encoding="utf-8")
print(json.dumps({"source_unchanged": True, "resumes": manifest}, indent=2))
