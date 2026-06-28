from django.db import models


class Ticket(models.Model):
    subject = models.CharField(max_length=200)
    status = models.CharField(max_length=32, default="open")
