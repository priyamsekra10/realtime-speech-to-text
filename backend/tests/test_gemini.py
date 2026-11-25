from app.stt.gemini import tidy


def test_tidy_adds_the_space_the_api_leaves_out():
    assert tidy("chahiye.आज का weather") == "chahiye. आज का weather"
    assert tidy("चाहिए।आज") == "चाहिए। आज"
    assert tidy("ready?Yes") == "ready? Yes"


def test_tidy_leaves_numbers_and_spaced_text_alone():
    assert tidy("at 10.30 am") == "at 10.30 am"
    assert tidy("version 3.5 is out. Good.") == "version 3.5 is out. Good."
    assert tidy("  hello  ") == "hello"
