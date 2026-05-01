"""
Unit tests for custom LangChain message types (models/custom_messages.py).
"""

from models.custom_messages import ContextMessage, ImageMessage, FileMessage, TaskMessage


class TestContextMessage:
    def test_type_field(self):
        msg = ContextMessage(content="user context")
        assert msg.type == "context"

    def test_content_preserved(self):
        msg = ContextMessage(content="Hello world")
        assert msg.content == "Hello world"


class TestImageMessage:
    def test_type_field(self):
        msg = ImageMessage(content="image data")
        assert msg.type == "image"


class TestFileMessage:
    def test_type_field(self):
        msg = FileMessage(content="https://example.com/file.pdf")
        assert msg.type == "file"


class TestTaskMessage:
    def test_type_field(self):
        msg = TaskMessage(content="Please process this task")
        assert msg.type == "task"
