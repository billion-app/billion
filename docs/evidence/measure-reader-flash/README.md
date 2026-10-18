# Measure reader startup

Captured on an iPhone 17 Pro simulator running iOS 26.5, using a development build and the bundled Proposition 40 fixture at `/trillion-preview?number=40`. This is fixture evidence, not a live ballot or production build.

The [startup frame](reader-startup.png) shows the reader document while its bundle loads. The [rendered frame](reader-loaded.png) shows the loaded reader. The live ballot-list flow was unavailable because API data failed to load in the simulator.

The screenshots were captured in the implementation checkout before applying the identical six-line reader fix to the PR branch based on current main. The reader source on both bases was identical. The change sets the initial document background before reader CSS loads; it does not change the final layout or copy.
