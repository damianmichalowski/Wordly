import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { PageSheetModal } from "@/src/components/ui/PageSheetModal";
import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import { prepareWordReportComment } from "@/src/services/wordReport/wordReportComment";
import { submitWordReport } from "@/src/services/wordReport/wordReport.service";
import {
  WORD_REPORT_COMMENT_MAX_LENGTH,
  WORD_REPORT_ISSUE_TYPES,
  type WordReportIssueType,
} from "@/src/services/wordReport/wordReport.types";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

import { wordReportSheetStyles as s } from "./wordReportSheetStyles";

type Props = {
  visible: boolean;
  wordId: string;
  lemma: string;
  onClose: () => void;
};

export function WordReportSheet({ visible, wordId, lemma, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [issueType, setIssueType] = useState<WordReportIssueType | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setIssueType(null);
      setComment("");
      setSubmitting(false);
      setError(null);
      setSubmitted(false);
    }
  }, [visible, wordId]);

  const dismiss = useCallback(() => {
    if (submitting) {
      return;
    }
    onClose();
  }, [onClose, submitting]);

  const trimmedCommentLength = useMemo(() => comment.trim().length, [comment]);
  const commentTooLong =
    trimmedCommentLength > WORD_REPORT_COMMENT_MAX_LENGTH;

  const onSubmit = useCallback(async () => {
    if (!issueType || submitting || commentTooLong) {
      return;
    }
    const prepared = prepareWordReportComment(comment);
    if (!prepared.ok) {
      setError(
        t("wordDetails.report.commentTooLong", {
          max: WORD_REPORT_COMMENT_MAX_LENGTH,
        }),
      );
      return;
    }
    logUserAction("button_press", {
      target: "word_report_submit",
      wordId,
      issueType,
    });
    setSubmitting(true);
    setError(null);
    try {
      await submitWordReport({
        wordId,
        issueType,
        comment: prepared.comment,
      });
      setSubmitted(true);
    } catch (e) {
      if (e instanceof Error && e.message === "WORD_REPORT_COMMENT_TOO_LONG") {
        setError(
          t("wordDetails.report.commentTooLong", {
            max: WORD_REPORT_COMMENT_MAX_LENGTH,
          }),
        );
      } else {
        setError(
          e instanceof Error ? e.message : t("wordDetails.report.submitError"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [comment, commentTooLong, issueType, submitting, t, wordId]);

  const onCommentChange = useCallback((text: string) => {
    setComment(text);
    setError(null);
  }, []);

  return (
    <PageSheetModal visible={visible} onRequestClose={dismiss}>
      <View style={s.root}>
        <ScreenHeader
          title={t("wordDetails.report.sheetTitle")}
          subtitle={lemma}
          onBackPress={dismiss}
        />

        {submitted ? (
          <View style={s.successBlock}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={StitchColors.primary}
            />
            <Text style={s.successTitle}>
              {t("wordDetails.report.successTitle")}
            </Text>
            <Text style={s.successBody}>
              {t("wordDetails.report.successBody")}
            </Text>
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                s.submitBtn,
                { alignSelf: "stretch", marginTop: 16 },
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={dismiss}
            >
              <Text style={s.submitBtnText}>
                {t("wordDetails.report.close")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              style={s.scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.scrollContent}
            >
              <Text style={s.sectionLabel}>
                {t("wordDetails.report.issueSection")}
              </Text>
              {WORD_REPORT_ISSUE_TYPES.map((type, index) => {
                const selected = issueType === type;
                const isLast = index === WORD_REPORT_ISSUE_TYPES.length - 1;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      logUserAction("button_press", {
                        target: "word_report_issue_type",
                        issueType: type,
                      });
                      setIssueType(type);
                    }}
                    style={[s.optionRow, isLast && s.optionRowLast]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[s.radioOuter, selected && s.radioOuterOn]}
                    >
                      {selected ? <View style={s.radioInner} /> : null}
                    </View>
                    <Text style={s.optionLabel}>
                      {t(`wordDetails.report.issueTypes.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}

              <Text style={s.sectionLabel}>
                {t("wordDetails.report.commentSection")}
              </Text>
              <TextInput
                style={[
                  s.commentInput,
                  commentTooLong && s.commentInputInvalid,
                ]}
                value={comment}
                onChangeText={onCommentChange}
                placeholder={t("wordDetails.report.commentPlaceholder")}
                placeholderTextColor={StitchColors.onSurfaceVariant}
                multiline
                autoComplete="off"
                autoCorrect
                spellCheck
                editable={!submitting}
              />
              <Text
                style={[s.commentMeta, commentTooLong && s.commentMetaError]}
              >
                {t("wordDetails.report.commentCounter", {
                  count: trimmedCommentLength,
                  max: WORD_REPORT_COMMENT_MAX_LENGTH,
                })}
              </Text>
              {commentTooLong ? (
                <Text style={s.errorText} accessibilityRole="alert">
                  {t("wordDetails.report.commentTooLong", {
                    max: WORD_REPORT_COMMENT_MAX_LENGTH,
                  })}
                </Text>
              ) : null}
              {error && !commentTooLong ? (
                <Text style={s.errorText}>{error}</Text>
              ) : null}
            </ScrollView>

            <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>
              <Pressable
                android_ripple={ANDROID_RIPPLE_PRIMARY}
                style={({ pressed }) => [
                  s.submitBtn,
                  (!issueType || submitting || commentTooLong) &&
                    s.submitBtnDisabled,
                  primarySolidPressStyle(
                    pressed,
                    !issueType || submitting || commentTooLong,
                  ),
                ]}
                onPress={() => void onSubmit()}
                disabled={!issueType || submitting || commentTooLong}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !issueType || submitting || commentTooLong,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color={StitchColors.onPrimary} />
                ) : (
                  <Text style={s.submitBtnText}>
                    {t("wordDetails.report.submit")}
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </PageSheetModal>
  );
}
