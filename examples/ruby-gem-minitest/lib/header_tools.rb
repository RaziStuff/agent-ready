module HeaderTools
  def self.valid?(name)
    name.match?(/\A[A-Za-z-]+\z/)
  end
end
