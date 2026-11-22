"""API tests with a fake model: no network, no API key, no cost."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import Settings
from app.llm import LlmError
from app.schemas import CvExtractOut, RequirementsOut, strict_schema

TOKEN = "test-token-123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

CV_TEXT = """Carlos Mendez
Software Developer
carlos@example.com | Mexico City

EXPERIENCE
Senior React Developer, Nube Labs, Mexico City, Mar 2021 - Present
Built the customer dashboard used by 40 teams.

EDUCATION
BSc Computer Science, UNAM, 2014 - 2018

SKILLS
React, TypeScript, Node.js
"""


class FakeLlm:
    def __init__(self, answer: dict[str, Any] | Exception) -> None:
        self.answer = answer
        self.calls: list[dict[str, Any]] = []

    async def json(self, *, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        self.calls.append({"system": system, "user": user, "schema": schema})
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


def client_with(answer: dict[str, Any] | Exception, token: str = TOKEN) -> tuple[TestClient, FakeLlm]:
    fake = FakeLlm(answer)
    settings = Settings(
        service_token=token, model="claude-opus-5-5", effort="medium", max_input_chars=80000, has_api_key=True
    )
    main.app.dependency_overrides = {main.get_settings: lambda: settings, main.get_llm: lambda: fake}
    return TestClient(main.app), fake


def cv_answer(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "personal": {
            "fullName": "Carlos Mendez", "headline": "Software Developer", "email": "carlos@example.com",
            "phone": "", "location": "Mexico City", "website": "", "linkedin": "",
        },
        "summary": "",
        "experience": [
            {
                "title": "Senior React Developer", "employer": "Nube Labs", "location": "Mexico City",
                "start": "2021-03", "end": "", "current": True,
                "description": "Built the customer dashboard used by 40 teams.",
            }
        ],
        "education": [
            {
                "degree": "BSc Computer Science", "institution": "UNAM", "location": "",
                "start": "2014", "end": "2018", "grade": "", "details": "",
            }
        ],
        "skills": ["React", "TypeScript", "Node.js"],
        "certifications": [], "languages": [], "projects": [], "publications": [], "awards": [],
        "memberships": [], "references": "", "unassigned": [],
    }
    base.update(over)
    return base


@pytest.fixture(autouse=True)
def _reset() -> Any:
    yield
    main.app.dependency_overrides = {}


def test_health_does_not_need_a_token() -> None:
    c, _ = client_with({})
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_requests_need_the_shared_token() -> None:
    c, fake = client_with(cv_answer())
    assert c.post("/v1/cv/parse", json={"text": CV_TEXT}).status_code == 401
    assert c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert fake.calls == []


def test_service_refuses_when_no_token_is_configured() -> None:
    c, _ = client_with(cv_answer(), token="")
    r = c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers={"Authorization": "Bearer "})
    assert r.status_code == 503


def test_parse_returns_app_shaped_cv() -> None:
    c, fake = client_with(cv_answer())
    r = c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["method"] == "ai"
    assert body["data"]["personal"]["fullName"] == "Carlos Mendez"
    assert body["data"]["experience"][0]["employer"] == "Nube Labs"
    assert body["data"]["skills"][0] == {"name": "React", "level": ""}
    assert body["dropped"] == []
    assert "experience" in body["found"]
    # The CV is passed to the model inside tags, and the schema is strict.
    assert "<cv>" in fake.calls[0]["user"]
    assert fake.calls[0]["schema"]["additionalProperties"] is False


def test_parse_removes_facts_that_are_not_in_the_cv() -> None:
    invented = cv_answer(
        experience=[
            {
                "title": "Engineering Manager", "employer": "Google", "location": "Mexico City",
                "start": "2010-01", "end": "2012", "current": False, "description": "Led 200 engineers.",
            }
        ],
        skills=["React", "Kubernetes"],
    )
    c, _ = client_with(invented)
    body = c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers=AUTH).json()
    job = body["data"]["experience"][0]
    assert job["employer"] == "" and job["title"] == "" and job["description"] == ""
    assert job["start"] == "" and job["end"] == ""
    assert [s["name"] for s in body["data"]["skills"]] == ["React"]
    assert "experience.employer" in body["dropped"]


def test_parse_clears_end_date_for_current_job_and_rejects_bad_dates() -> None:
    answer = cv_answer()
    answer["experience"][0]["end"] = "2023"
    answer["education"][0]["start"] = "September"
    c, _ = client_with(answer)
    body = c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers=AUTH).json()
    assert body["data"]["experience"][0]["end"] == ""
    assert body["data"]["education"][0]["start"] == ""


def test_parse_rejects_short_text() -> None:
    c, _ = client_with(cv_answer())
    assert c.post("/v1/cv/parse", json={"text": "too short"}, headers=AUTH).status_code == 422


def test_improve_keeps_original_when_suggestion_adds_facts() -> None:
    answer = {
        "items": [
            {"id": "a", "improved": "Built a customer dashboard used by 40 teams."},
            {"id": "b", "improved": "Cut costs by 35% using Salesforce."},
        ]
    }
    c, _ = client_with(answer)
    r = c.post(
        "/v1/cv/improve",
        json={"items": [
            {"id": "a", "text": "I was responsible for building the customer dashboard, used by 40 teams"},
            {"id": "b", "text": "helped reduce costs"},
        ]},
        headers=AUTH,
    )
    items = {i["id"]: i for i in r.json()["items"]}
    assert items["a"]["changed"] is True
    assert items["b"]["changed"] is False
    assert items["b"]["improved"] == "helped reduce costs"


def test_improve_allows_placeholders() -> None:
    answer = {"items": [{"id": "a", "improved": "Reduced costs [add the % saved in 2024]."}]}
    c, _ = client_with(answer)
    r = c.post("/v1/cv/improve", json={"items": [{"id": "a", "text": "helped reduce costs"}]}, headers=AUTH)
    assert r.json()["items"][0]["changed"] is True


OPP = {
    "title": "Frontend Engineer",
    "organization": "Acme Health",
    "description": "We need React and TypeScript. Remote, open worldwide.",
    "requirements": {"skills": ["React", "TypeScript"]},
}
CV = {
    "personal": {"fullName": "Carlos Mendez"},
    "experience": [{"title": "Senior React Developer", "employer": "Nube Labs", "description": "Built the customer dashboard used by 40 teams."}],
    "skills": [{"name": "React"}, {"name": "TypeScript"}],
}


def test_cover_letter_is_returned_when_grounded() -> None:
    letter = (
        "Dear Acme Health team,\n\nI am applying for the Frontend Engineer role. As a Senior React Developer "
        "at Nube Labs I built the customer dashboard used by 40 teams [add one more result].\n\n"
        "Yours sincerely,\nCarlos Mendez"
    )
    c, _ = client_with({"body": letter})
    r = c.post("/v1/cover-letter", json={"cv": CV, "opportunity": OPP}, headers=AUTH)
    assert r.status_code == 200
    assert r.json()["body"].startswith("Dear Acme Health")


def test_cover_letter_with_invented_facts_is_rejected() -> None:
    letter = "Dear Acme Health team,\n\nAt Microsoft I led 12 engineers.\n\nYours sincerely,\nCarlos Mendez"
    c, _ = client_with({"body": letter})
    r = c.post("/v1/cover-letter", json={"cv": CV, "opportunity": OPP}, headers=AUTH)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "ungrounded"


def req_answer(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {k: None for k in RequirementsOut.model_fields}
    base.update(
        applicant_type="individual", eligible_countries=[], places=[], degree_levels=[], fields=[],
        skills=[], languages=[], certifications=[], licenses=[], procurement_categories=[],
        funding="unknown", required_documents=[],
    )
    base.update(over)
    return base


def test_requirements_drop_numbers_and_skills_not_in_the_notice() -> None:
    notice = "Frontend Engineer. At least 3 years of experience with React. Closing date 2026-12-15."
    c, _ = client_with(req_answer(min_experience_years=5, skills=["React", "GraphQL"], deadline="2026-12-15"))
    body = c.post("/v1/requirements/extract", json={"title": "Frontend Engineer", "description": notice}, headers=AUTH).json()
    assert body["requirements"]["min_experience_years"] is None
    assert body["requirements"]["skills"] == ["React"]
    assert body["requirements"]["deadline"] == "2026-12-15"
    assert "min_experience_years" in body["dropped"]


def test_requirements_keep_stated_numbers() -> None:
    notice = "Frontend Engineer. At least 3 years of experience with React."
    c, _ = client_with(req_answer(min_experience_years=3))
    body = c.post("/v1/requirements/extract", json={"title": "Frontend Engineer", "description": notice}, headers=AUTH).json()
    assert body["requirements"]["min_experience_years"] == 3


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (LlmError("busy", "busy", True), 503),
        (LlmError("refused", "declined"), 422),
        (LlmError("upstream", "error"), 502),
    ],
)
def test_model_errors_map_to_clear_statuses(error: LlmError, status: int) -> None:
    c, _ = client_with(error)
    r = c.post("/v1/cv/parse", json={"text": CV_TEXT}, headers=AUTH)
    assert r.status_code == status
    assert r.json()["detail"]["code"] == error.code


def test_output_schemas_are_strict_everywhere() -> None:
    def check(node: Any) -> None:
        if isinstance(node, dict):
            assert "$ref" not in node
            if node.get("type") == "object" and "properties" in node:
                assert node["additionalProperties"] is False
                assert set(node["required"]) == set(node["properties"])
            for v in node.values():
                check(v)
        elif isinstance(node, list):
            for v in node:
                check(v)

    check(strict_schema(CvExtractOut))
    check(strict_schema(RequirementsOut))
