<?php

use Acme\PestAssertionTools\Matcher;

it('matches identical values', function () {
    expect((new Matcher())->matches('open', 'open'))->toBeTrue();
});
