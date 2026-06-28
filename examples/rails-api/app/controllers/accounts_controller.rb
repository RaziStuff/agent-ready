class AccountsController < ApplicationController
  def index
    render json: Account.limit(25)
  end
end
