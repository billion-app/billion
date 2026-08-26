import ExpoModulesCore
import UIKit

/**
 Hands a story-sized image straight to Instagram Stories.

 Instagram's documented handoff is a pasteboard write plus a URL open: the
 image goes on the general pasteboard under `com.instagram.sharedSticker.*`
 keys, and opening `instagram-stories://share?source_application=<appID>`
 tells Instagram to read it. There is no way to do this from JavaScript — the
 keys are custom pasteboard types — which is why this module exists rather
 than falling back to the system share sheet.

 The pasteboard item is written with an expiry so a story the reader never
 posts does not sit in their clipboard afterwards.

 `Info.plist` must list `instagram-stories` under `LSApplicationQueriesSchemes`
 or `canOpenURL` always answers false; the config plugin adds it.
 */
public final class InstagramStoryModule: Module {
  /// Instagram reads these exact keys. They are contractual, not descriptive.
  private static let backgroundImageKey = "com.instagram.sharedSticker.backgroundImage"
  private static let stickerImageKey = "com.instagram.sharedSticker.stickerImage"
  private static let contentURLKey = "com.instagram.sharedSticker.contentURL"

  private static let shareURL = URL(string: "instagram-stories://share")

  public func definition() -> ModuleDefinition {
    Name("InstagramStory")

    /// Whether Instagram is installed and willing to receive a story.
    AsyncFunction("isAvailableAsync") { () -> Bool in
      guard let url = Self.shareURL else { return false }
      return await MainActor.run { UIApplication.shared.canOpenURL(url) }
    }

    /**
     Writes `fileUri` to the pasteboard as a story background and opens
     Instagram.

     - Parameters:
       - fileUri: a local `file://` URL for a PNG or JPEG.
       - appId: the Facebook app id Instagram attributes the share to. Passed
         as `source_application`; Instagram still opens without a registered
         id, it simply does not attribute the share.
       - contentUrl: optional link carried alongside the sticker, surfaced by
         Instagram for accounts allowed to attach links.
     */
    AsyncFunction("shareAsync") { (fileUri: String, appId: String?, contentUrl: String?) -> Bool in
      guard let shareURL = Self.shareURL else { return false }

      guard
        let source = URL(string: fileUri),
        let data = try? Data(contentsOf: source),
        let image = UIImage(data: data),
        // Re-encode rather than passing the bytes through: Instagram rejects
        // anything it cannot read as an image, and a re-encode normalises
        // whatever the server sent.
        let png = image.pngData()
      else {
        throw ImageUnreadableException(fileUri)
      }

      return try await MainActor.run {
        guard UIApplication.shared.canOpenURL(shareURL) else {
          throw InstagramMissingException()
        }

        var item: [String: Any] = [Self.backgroundImageKey: png]
        if let contentUrl, !contentUrl.isEmpty {
          item[Self.contentURLKey] = contentUrl
        }

        // Expires so an unposted story does not linger on the clipboard.
        UIPasteboard.general.setItems(
          [item],
          options: [.expirationDate: Date().addingTimeInterval(300)]
        )

        var components = URLComponents(url: shareURL, resolvingAgainstBaseURL: false)
        if let appId, !appId.isEmpty {
          components?.queryItems = [URLQueryItem(name: "source_application", value: appId)]
        }
        guard let opened = components?.url else { throw InstagramMissingException() }

        UIApplication.shared.open(opened, options: [:], completionHandler: nil)
        return true
      }
    }

    /// Kept so the sticker key is not dead weight if a caller wants it later.
    Constants([
      "stickerImageKey": Self.stickerImageKey
    ])
  }
}

internal final class InstagramMissingException: Exception {
  override var reason: String {
    "Instagram is not installed, or instagram-stories is missing from LSApplicationQueriesSchemes"
  }
}

internal final class ImageUnreadableException: GenericException<String> {
  override var reason: String {
    "Could not read a shareable image from \(param)"
  }
}
