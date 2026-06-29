Gem::Specification.new do |spec|
  spec.name = "header_tools"
  spec.version = "0.1.0"
  spec.summary = "Ruby gem for validating HTTP header names."
  spec.authors = ["Example Maintainers"]
  spec.files = Dir["lib/**/*.rb"]
  spec.required_ruby_version = ">= 3.1"

  spec.add_development_dependency "minitest"
  spec.add_development_dependency "rake"
  spec.add_development_dependency "rubocop"
end
