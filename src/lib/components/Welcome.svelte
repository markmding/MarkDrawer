<script lang="ts">
  // MARK#EZVE.COM
  import { BRAND_NAME, BRAND_NAME_ZH, BRAND_SLOGAN_EN, BRAND_SLOGAN_ZH } from '../brand'
  import { isEnglish, t } from '../i18n'

  let {
    onopen,
    ondemo,
    busy = false
  }: { onopen: () => void; ondemo: () => void; busy?: boolean } = $props()
</script>

<div class="welcome">
  <div class="welcome-card">
    <div class="welcome-mark">文</div>
    <h1>{BRAND_NAME} <span class="welcome-zh">{BRAND_NAME_ZH}</span></h1>
    <p class="welcome-slogan">{isEnglish() ? BRAND_SLOGAN_EN : BRAND_SLOGAN_ZH}</p>
    <p>
      {t('welcome.desc')}
    </p>

    <div class="welcome-actions">
      <button class="button primary" onclick={onopen} disabled={busy}>
        {busy ? t('welcome.opening') : t('welcome.open')}
      </button>
      <button class="button" onclick={ondemo} disabled={busy}>{t('welcome.demo')}</button>
    </div>

    <div class="welcome-points">
      <div>{t('welcome.pointDrawer')}</div>
      <div>{t('welcome.pointAst')}</div>
      <div>{t('welcome.pointKeys')}</div>
    </div>
  </div>
</div>

<style>
  .welcome-zh {
    font-size: 0.62em;
    color: var(--text-muted);
    font-weight: 500;
    letter-spacing: 0.08em;
  }
  .welcome-slogan {
    letter-spacing: 0.22em;
    color: var(--accent);
    font-size: 13px;
    margin-top: -4px;
  }
</style>
