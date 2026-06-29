<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('support:refresh-queues', function () {
    $this->comment('Support queues refreshed.');
});
