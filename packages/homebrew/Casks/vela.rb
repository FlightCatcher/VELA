cask "vela" do
  version "2.5.0-beta.4"

  on_arm do
    sha256 "214550f556d0a2fb3ac84dfdf5ff0e3397b787625ee4b0bd6904ff73478f9ecb"
    url "https://github.com/FlightCatcher/VELA/releases/download/v#{version}/VELA-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "25cbcfefd31f9a6fbfa22440b1381e48d56b6be1ea62afb95e68c587bd2d2b74"
    url "https://github.com/FlightCatcher/VELA/releases/download/v#{version}/VELA-#{version}-x64.dmg"
  end

  name "VELA"
  desc "Local-first modular AI agent desktop application"
  homepage "https://github.com/FlightCatcher/VELA"

  app "VELA.app"

  caveats <<~EOS
    This public beta is not yet Apple-notarized. If macOS blocks the first
    launch, open System Settings > Privacy & Security and explicitly allow VELA.
  EOS

  zap trash: [
    "~/Library/Application Support/vela-desktop",
    "~/Library/Logs/vela-desktop",
    "~/Library/Preferences/com.vela.desktop.plist",
    "~/Library/Saved Application State/com.vela.desktop.savedState",
  ]
end
