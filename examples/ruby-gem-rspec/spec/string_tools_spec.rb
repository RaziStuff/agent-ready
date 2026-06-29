require "string_tools"

RSpec.describe StringTools do
  it "normalizes strings" do
    expect(described_class.normalize(" Hello ")).to eq("hello")
  end
end
