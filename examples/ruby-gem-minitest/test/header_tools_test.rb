require "minitest/autorun"
require "header_tools"

class HeaderToolsTest < Minitest::Test
  def test_valid_header
    assert HeaderTools.valid?("Content-Type")
  end
end
