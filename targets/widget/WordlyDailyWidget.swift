import SwiftUI
import WidgetKit

private let appGroupId = "group.com.wordly.mobile"
private let snapshotKey = "wordly.widget.snapshot.v1"

/// Zgodne z `StitchColors.primary` w aplikacji (#4456BA).
private let wordlyBrandPrimary = Color(red: 68 / 255, green: 86 / 255, blue: 186 / 255)

/// Odstęp treści od krawędzi komórki (standard zbliżony do domyślnych marginesów WidgetKit ~16 pt).
private enum WordlyWidgetContentPadding {
  static let small: CGFloat = 16
  static let medium: CGFloat = 18
}

/// Hierarchia: marka → **słowo (bohater)** → tłumaczenie (drugi plan, do przeczytania).
private enum WordlyWidgetLayout {
  static let brandToHeroSmall: CGFloat = 8
  static let brandToHeroMedium: CGFloat = 10
  static let heroToTranslationSmall: CGFloat = 12
  static let heroToTranslationMedium: CGFloat = 14
}

private struct SnapshotPayload: Codable {
  let deepLink: String
  let knownDeepLink: String?
  let stateVersion: Int
  let updatedAt: String
  let sourceLanguage: String
  let targetLanguage: String
  let displayLevel: String
  let wordId: String?
  let sourceText: String?
  let targetText: String?
  let emptyReason: String?
  let uiState: String?
}

struct WordlyDailyWidget: Widget {
  let kind: String = "WordlyDailyWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WordlyDailyWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Wordly")
    .description("Słowo i tłumaczenie.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryInline,
      .accessoryRectangular,
    ])
    .contentMarginsDisabled()
  }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(
      date: Date(),
      learningWord: "resilient",
      translationWord: "odporny",
      deepLink: "wordly://home",
      knownDeepLink: nil,
      isPlaceholder: true,
      isLoading: false
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = loadEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    let timeline = Timeline(entries: [entry], policy: .after(next))
    completion(timeline)
  }

  private func loadEntry() -> Entry {
    guard let defaults = UserDefaults(suiteName: appGroupId),
          let json = defaults.string(forKey: snapshotKey),
          let data = json.data(using: .utf8),
          let payload = try? JSONDecoder().decode(SnapshotPayload.self, from: data)
    else {
      return Entry(
        date: Date(),
        learningWord: "",
        translationWord: nil,
        deepLink: "wordly://home",
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: false
      )
    }

    if payload.uiState == "loading" {
      return Entry(
        date: Date(),
        learningWord: "",
        translationWord: nil,
        deepLink: payload.deepLink,
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: true
      )
    }

    if payload.emptyReason != nil {
      return Entry(
        date: Date(),
        learningWord: "",
        translationWord: nil,
        deepLink: payload.deepLink,
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: false
      )
    }

    let learning = payload.sourceText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let translation = payload.targetText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    return Entry(
      date: Date(),
      learningWord: learning,
      translationWord: translation.isEmpty ? nil : translation,
      deepLink: payload.deepLink,
      knownDeepLink: payload.knownDeepLink,
      isPlaceholder: false,
      isLoading: false
    )
  }
}

struct Entry: TimelineEntry {
  let date: Date
  let learningWord: String
  let translationWord: String?
  let deepLink: String
  let knownDeepLink: String?
  let isPlaceholder: Bool
  let isLoading: Bool
}

struct WordlyDailyWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: Entry

  var body: some View {
    if entry.isLoading {
      switch family {
      case .accessoryInline, .accessoryRectangular:
        ProgressView()
          .widgetURL(URL(string: entry.deepLink))
      case .systemMedium:
        mediumLoading
      default:
        smallLoading
      }
    } else {
      switch family {
      case .accessoryInline:
        accessoryInline
      case .accessoryRectangular:
        accessoryRectangular
      case .systemMedium:
        mediumHome
      default:
        smallHome
      }
    }
  }

  private var smallLoading: some View {
    Group {
      if #available(iOS 17.0, *) {
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
          .padding(WordlyWidgetContentPadding.small)
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack {
          wordlyWidgetDecorativeBackdrop
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(WordlyWidgetContentPadding.small)
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var mediumLoading: some View {
    Group {
      if #available(iOS 17.0, *) {
        ProgressView()
          .scaleEffect(1.15)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
          .padding(WordlyWidgetContentPadding.medium)
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack {
          wordlyWidgetDecorativeBackdrop
          ProgressView()
            .scaleEffect(1.15)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding(WordlyWidgetContentPadding.medium)
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  /// Jednolite tło: gradient schodzi do `systemBackground` (bez `clear`), żeby nie było „drugiej ramki”.
  private var wordlyWidgetDecorativeBackdrop: some View {
    let bg = Color(.systemBackground)
    return LinearGradient(
      stops: [
        .init(color: wordlyBrandPrimary.opacity(0.10), location: 0),
        .init(color: wordlyBrandPrimary.opacity(0.035), location: 0.5),
        .init(color: bg, location: 1)
      ],
      startPoint: .topTrailing,
      endPoint: .bottomLeading
    )
  }

  /// Treść małego widżetu (bez tła — tło w `containerBackground` na iOS 17+).
  private var homeContentSmall: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("Wordly")
        .font(.caption2)
        .fontWeight(.semibold)
        .foregroundStyle(wordlyBrandPrimary.opacity(0.9))

      Text(entry.learningWord)
        .font(.system(size: 26, weight: .bold, design: .default))
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.66)
        .lineLimit(3)
        .padding(.top, WordlyWidgetLayout.brandToHeroSmall)

      if let t = entry.translationWord {
        Text(t)
          .font(.footnote)
          .fontWeight(.regular)
          .foregroundStyle(.secondary)
          .lineSpacing(3)
          .minimumScaleFactor(0.8)
          .lineLimit(6)
          .padding(.top, WordlyWidgetLayout.heroToTranslationSmall)
      }
    }
    .padding(WordlyWidgetContentPadding.small)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var homeContentMedium: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("Wordly")
        .font(.caption2)
        .fontWeight(.semibold)
        .foregroundStyle(wordlyBrandPrimary.opacity(0.9))

      Text(entry.learningWord)
        .font(.system(size: 32, weight: .bold, design: .default))
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.64)
        .lineLimit(2)
        .lineSpacing(2)
        .padding(.top, WordlyWidgetLayout.brandToHeroMedium)

      if let t = entry.translationWord {
        Text(t)
          .font(.callout)
          .fontWeight(.regular)
          .foregroundStyle(.secondary)
          .lineSpacing(4)
          .minimumScaleFactor(0.78)
          .lineLimit(5)
          .padding(.top, WordlyWidgetLayout.heroToTranslationMedium)
      }
    }
    .padding(WordlyWidgetContentPadding.medium)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  /// iOS 17+: `containerBackground` maluje tło pod całą komórką; `contentMarginsDisabled` usuwa domyślny „padding” systemowy (biała obwódka).
  private var smallHome: some View {
    Group {
      if #available(iOS 17.0, *) {
        homeContentSmall
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
          homeContentSmall
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var mediumHome: some View {
    Group {
      if #available(iOS 17.0, *) {
        homeContentMedium
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
          homeContentMedium
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var accessoryInline: some View {
    ViewThatFits(in: .horizontal) {
      Text(entry.learningWord)
        .font(.caption)
        .fontWeight(.semibold)
        .widgetURL(URL(string: entry.deepLink))
      Text(entry.learningWord)
        .font(.caption2)
        .widgetURL(URL(string: entry.deepLink))
    }
  }

  private var accessoryRectangular: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(entry.learningWord)
        .font(.headline)
        .fontWeight(.bold)
        .minimumScaleFactor(0.8)
        .lineLimit(1)
      if let t = entry.translationWord {
        Text(t)
          .font(.caption2)
          .fontWeight(.regular)
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .padding(.top, 4)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(URL(string: entry.deepLink))
  }
}
