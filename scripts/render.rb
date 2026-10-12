# Renders a dist/ layout with Ruby Liquid, the engine TRMNL uses, for the tests:
#   ruby scripts/render.rb <layout> <context.json> <now ISO>
# Prints the HTML; exits 1 on Liquid errors. Needs the liquid gem (gem install liquid).
ENV["TZ"] = "UTC"
require "liquid"
require "json"
require "time"

layout, context, now = ARGV
$now = Time.parse(now).utc
class Time
  class << self
    alias_method :real_now, :now
    def now
      $now
    end
  end
end

source = File.read(File.join(__dir__, "..", "dist", "#{layout}.liquid"), encoding: "UTF-8")
template = Liquid::Template.parse(source, error_mode: :strict, line_numbers: true)
html = template.render(JSON.parse(File.read(context, encoding: "UTF-8")))
unless template.errors.empty?
  warn template.errors.map(&:to_s).uniq.first(10)
  exit 1
end
print html
