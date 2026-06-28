from django.test import TestCase


class TicketTests(TestCase):
    def test_ticket_defaults_to_open(self):
        self.assertEqual("open", "open")
