package com.acme.orders;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class OrderController {
  @GetMapping("/health")
  String health() {
    return "ok";
  }
}
