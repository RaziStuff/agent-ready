<?php

namespace Acme\PestAssertionTools;

class Matcher
{
    public function matches(mixed $actual, mixed $expected): bool
    {
        return $actual === $expected;
    }
}
