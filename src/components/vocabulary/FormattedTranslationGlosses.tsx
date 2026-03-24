import type { ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";

import {
  StitchColors,
  StitchFonts,
} from "@/src/theme/wordlyStitchTheme";
import {
  vocabularyWordDisplayTargetText,
  type VocabularyWord,
} from "@/src/types/words";

const defaultSeparatorStyle: TextStyle = {
  color: StitchColors.outlineVariant,
  fontFamily: StitchFonts.bodyMedium,
};

type Props = {
  word: VocabularyWord;
  style?: TextStyle;
  separatorStyle?: TextStyle;
} & Pick<TextProps, "numberOfLines">;

/**
 * Jedno tłumaczenie albo kilka sensów z wizualnym separatorem (·), nie surowym ukośnikiem.
 */
export function FormattedTranslationGlosses({
  word,
  style,
  separatorStyle,
  numberOfLines,
}: Props) {
  const parts = word.targetGlossParts;
  const sep = { ...defaultSeparatorStyle, ...separatorStyle };

  if (!parts || parts.length <= 1) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {vocabularyWordDisplayTargetText(word)}
      </Text>
    );
  }

  /** Bez zagnieżdżonego `Text` na każdy segment (na Androidzie/iOS potrafi to z `numberOfLines` dać pusty wiersz). */
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      nodes.push(
        <Text key={`sep-${i}`} style={sep}>
          {" · "}
        </Text>,
      );
    }
    nodes.push(parts[i]);
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {nodes}
    </Text>
  );
}
