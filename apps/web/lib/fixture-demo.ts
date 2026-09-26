/** Demo pengembangan eksplisit, tidak boleh aktif di deployment produksi. */
export function isFixtureDemoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.CHECK_FIXTURE_DEMO === '1';
}
