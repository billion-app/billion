cd apps/expo
pnpm expo prebuild --platform ios --clean
cd ios && pod install && cd .U
open ios/billion.xcworkspace
cd ../..
echo "Run `pnpm -F @acme/expo dev` or just `pnpm dev`"

