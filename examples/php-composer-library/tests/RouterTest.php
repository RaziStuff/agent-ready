<?php

namespace Acme\LogTools\Tests;

use Acme\LogTools\Router;
use PHPUnit\Framework\TestCase;

class RouterTest extends TestCase
{
    public function testRoutesChannels(): void
    {
        $this->assertSame('billing', (new Router())->route('Billing'));
    }
}
