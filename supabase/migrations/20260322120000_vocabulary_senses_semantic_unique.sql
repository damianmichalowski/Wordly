-- Zapobiega duplikatom tego samego sensu (ta sama para języków, ta sama część mowy i to samo tłumaczenie)
-- przy importach z wielu źródeł (Oxford, CEFR-J, 10k CEFR itd.).
-- Różne znaczenia tego samego wyrazu = osobne wiersze (inny gloss lub inny part_of_speech).

create unique index if not exists idx_vocabulary_senses_semantic_unique
  on public.vocabulary_senses (
    lemma_id,
    target_language_code,
    lower(trim(part_of_speech)),
    lower(trim(gloss_text))
  );

comment on index public.idx_vocabulary_senses_semantic_unique is
  'Jednoznaczna identyfikacja sensu: lemat + język docelowy + POS + tłumaczenie (znormalizowane).';
