<?php

namespace Acme\LogTools;

class Router
{
    public function route(string $channel): string
    {
        return strtolower($channel);
    }
}
