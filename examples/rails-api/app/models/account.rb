class Account < ApplicationRecord
  validates :external_id, presence: true
end
