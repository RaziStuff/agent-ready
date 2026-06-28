class CreateAccounts < ActiveRecord::Migration[7.1]
  def change
    create_table :accounts do |table|
      table.string :external_id, null: false
      table.timestamps
    end
  end
end
