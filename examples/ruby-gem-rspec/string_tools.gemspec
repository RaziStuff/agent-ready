Gem::Specification.new do |spec|
  spec.name = "string_tools"
  spec.version = "0.1.0"
  spec.summary = "Ruby gem for normalizing customer-facing strings."
  spec.authors = ["Example Maintainers"]
  spec.files = Dir["lib/**/*.rb", "exe/*"]
  spec.bindir = "exe"
  spec.executables = ["string-tools"]
  spec.required_ruby_version = ">= 3.1"

  spec.add_development_dependency "rspec"
  spec.add_development_dependency "rubocop"
end
