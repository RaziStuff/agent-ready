RSpec.describe Account do
  it "requires an external id" do
    account = Account.new
    expect(account).not_to be_valid
  end
end
