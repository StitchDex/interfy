"""Tag-scoped project JSON remains editable in the offline partner editor.

Run from backend/: python -m unittest discover -s tests -v
"""
import json
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    IntegrationTarget, Message, MessageEnumValue, MessageField,
    MessageGroup, MessageGroupItem, MessageLabel, MessageLabelItem,
    MessageTxTargetItem, Project, User,
)
from app.routers.export import export_label_json, tag_scoped_project_json
from app.routers.project_json import _load_project_json, _validate_import_payload


class TagJsonExportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def foreign_keys(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(email="tester", display_name="tester", password_hash="test")
        self.db.add(self.user)
        self.db.flush()
        self.project = Project(
            name="Subsystem", acronym="SUB", owner_id=self.user.id,
        )
        self.db.add(self.project)
        self.db.flush()

        self.tag = MessageLabel(
            project_id=self.project.id, name="협력사 A", description="작업용 메시지",
        )
        self.other_tag = MessageLabel(
            project_id=self.project.id, name="다른 태그",
        )
        self.node = IntegrationTarget(project_id=self.project.id, name="제어SW")
        self.other_node = IntegrationTarget(project_id=self.project.id, name="무관SW")
        self.db.add_all([self.tag, self.other_tag, self.node, self.other_node])
        self.db.flush()

        self.root = Message(
            project_id=self.project.id, name="상태 메시지", struct_name="T_STATUS",
            period="비주기", definition_type="STRUCT",
        )
        self.ref = Message(
            project_id=self.project.id, name="공용 상태", struct_name="T_COMMON_ENUM",
            period="비주기", definition_type="ENUM", enum_underlying_type="uint32",
        )
        self.unrelated = Message(
            project_id=self.project.id, name="기타 메시지", struct_name="T_OTHER",
            period="비주기", definition_type="STRUCT",
        )
        self.db.add_all([self.root, self.ref, self.unrelated])
        self.db.flush()
        self.db.add_all([
            MessageField(
                message_id=self.root.id, name="status", variable_name="status",
                type_kind="ENUM", ref_message_id=self.ref.id, type="T_COMMON_ENUM",
                order_index=1,
            ),
            MessageEnumValue(
                message_id=self.ref.id, name="OK", value=0, order_index=1,
            ),
            MessageLabelItem(label_id=self.tag.id, message_id=self.root.id),
            MessageLabelItem(label_id=self.other_tag.id, message_id=self.unrelated.id),
            MessageTxTargetItem(target_id=self.node.id, message_id=self.root.id),
            MessageTxTargetItem(target_id=self.other_node.id, message_id=self.unrelated.id),
        ])
        self.group = MessageGroup(project_id=self.project.id, name="그룹A")
        self.db.add(self.group)
        self.db.flush()
        self.db.add(MessageGroupItem(group_id=self.group.id, message_id=self.root.id, order_index=1))
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_tag_export_contains_selected_messages_dependencies_and_relevant_nodes(self):
        response = export_label_json(self.tag.id, db=self.db, current_user=self.user)
        data = json.loads(response.body)
        self.assertEqual(data["format"], "interfy-project")
        self.assertEqual(data["version"], 1)
        self.assertIn("SUB_", response.headers["content-disposition"])
        self.assertEqual(
            {message["struct_name"] for message in data["messages"]},
            {"T_STATUS", "T_COMMON_ENUM"},
        )
        self.assertEqual([target["name"] for target in data["integration_targets"]], ["제어SW"])
        self.assertEqual([label["name"] for label in data["labels"]], ["협력사 A"])
        self.assertEqual(data["labels"][0]["messages"], ["T_STATUS"])
        self.assertEqual(data["groups"][0]["messages"], ["T_STATUS"])
        # The existing offline editor and partial-update importer both read this schema.
        normalized = _load_project_json(data)
        messages, groups, labels, targets = _validate_import_payload(normalized)
        self.assertEqual(len(messages), 2)
        self.assertEqual(len(groups), 1)
        self.assertEqual(len(labels), 1)
        self.assertEqual(len(targets), 1)

    def test_empty_tag_exports_valid_empty_working_set(self):
        tag = MessageLabel(project_id=self.project.id, name="빈 태그")
        self.db.add(tag)
        self.db.commit()
        data = json.loads(export_label_json(tag.id, db=self.db, current_user=self.user).body)
        self.assertEqual(data["messages"], [])
        self.assertEqual(data["integration_targets"], [])
        self.assertEqual([label["name"] for label in data["labels"]], ["빈 태그"])
        self.assertEqual(_validate_import_payload(_load_project_json(data))[0], [])

    def test_unrelated_tags_and_groups_are_excluded(self):
        data = json.loads(export_label_json(self.tag.id, db=self.db, current_user=self.user).body)
        self.assertFalse(any(m["struct_name"] == "T_OTHER" for m in data["messages"]))
        self.assertFalse(any(label["name"] == "다른 태그" for label in data["labels"]))

    def test_invalid_tag_returns_404(self):
        with self.assertRaises(HTTPException) as error:
            export_label_json(999999, db=self.db, current_user=self.user)
        self.assertEqual(error.exception.status_code, 404)

    def test_subset_does_not_mutate_original_payload(self):
        raw = {
            "messages": [{"name": "A", "struct_name": "A", "tx_targets": ["N"], "rx_targets": []},
                         {"name": "B", "struct_name": "B", "tx_targets": [], "rx_targets": []}],
            "groups": [{"name": "G", "messages": ["A", "B"]}],
            "labels": [{"name": "TAG", "messages": ["A", "B"]}],
            "integration_targets": [{"name": "N"}, {"name": "OTHER"}],
        }
        output = tag_scoped_project_json(raw, {"A"}, "TAG")
        self.assertEqual([m["struct_name"] for m in output["messages"]], ["A"])
        self.assertEqual(output["groups"][0]["messages"], ["A"])
        self.assertEqual(output["labels"][0]["messages"], ["A"])
        self.assertEqual(len(output["integration_targets"]), 1)
        self.assertEqual(raw["groups"][0]["messages"], ["A", "B"])


if __name__ == "__main__":
    unittest.main()
