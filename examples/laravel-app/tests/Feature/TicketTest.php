<?php

test('support portal homepage renders', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});
