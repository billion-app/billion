Pod::Spec.new do |s|
  s.name           = 'InstagramStory'
  s.version        = '0.1.0'
  s.summary        = 'Hands a story-sized image straight to Instagram Stories.'
  s.description    = 'Writes a story image to the pasteboard under Instagram\'s sharedSticker keys and opens instagram-stories://share.'
  s.author         = 'Billion'
  s.homepage       = 'https://billion-news.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
