from datetime import date

from requinoa_2026.severe_reports import clean, merge, parse, search_url

POST = {
    "date": "2026-10-26T18:05:00",
    "title": {"rendered": "Granizos y &#8220;tornado&#8221; en Requ&iacute;noa"},
    "excerpt": {"rendered": "<p>Unas 70 casas\n con da&ntilde;os.</p>"},
    "link": "https://example.cl/a",
}


def test_clean_strips_tags_and_entities():
    assert clean("<p>Unas 70 casas\n con da&ntilde;os.</p>") == "Unas 70 casas con daños."


def test_parse_keeps_local_time_and_plain_text():
    (row,) = parse([POST], "granizo")
    assert row["published_local"] == "2026-10-26 18:05"
    assert row["title"] == "Granizos y “tornado” en Requínoa"
    assert row["keyword"] == "granizo"


def test_merge_lists_an_article_once_with_all_its_keywords():
    later = {**POST, "date": "2026-10-27T09:00:00", "link": "https://example.cl/b"}
    table = merge(parse([later, POST], "tornado") + parse([POST], "granizo"))
    assert table.link.tolist() == ["https://example.cl/a", "https://example.cl/b"]
    assert table.keywords.tolist() == ["granizo; tornado", "tornado"]


def test_merge_of_nothing_is_an_empty_table():
    assert merge([]).empty


def test_search_url_asks_only_from_the_first_goes19_day():
    url = search_url("tormenta eléctrica", 2, since=date(2025, 4, 7))
    assert "after=2025-04-07T00%3A00%3A00" in url and "page=2" in url and "tormenta+el%C3%A9ctrica" in url
