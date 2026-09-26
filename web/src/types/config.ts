export interface ServerConfig {
  port: number;
  host: string;
  debug: boolean;
  header_position: 'top' | 'bottom';
  color_mode: 'light' | 'dark' | 'system';
  card_height?: 'sm' | 'md' | 'lg';
  /**
   * How opaque every card's painted surface is (base tint + category
   * background + any image), 0.0–1.0. Applies uniformly to want, want type,
   * agent, recipe, world, web want, device, character and achievement cards.
   * Icons, text and badges are never affected, so readability holds at any
   * value. Absent = CARD_OPACITY_DEFAULT (1.0 = the original solid look).
   */
  card_opacity?: number;
  /** System font size — scales card-face names and the hamburger menu together.
   *  'large' = the current sizes, 'medium' = the previous sizes, 'small' = smaller.
   *  Absent = 'large'. */
  system_font_size?: 'small' | 'medium' | 'large';
  sound_enabled?: boolean;
  /** Icon rendering style for category/type icons. Default: 'lucide'. */
  icon_font?: 'lucide' | 'lucide-thin' | 'heroicons-outline' | 'heroicons-solid';
  /**
   * Restrict place-name lookups to one country, as an ISO 3166-1 alpha-2 code
   * ("jp"). Cards that turn a name into coordinates pass it to the geocoder.
   * A bare name is ambiguous across the whole planet — "新宿駅" came back as a
   * city in Anhui, China — and one country is usually the honest answer.
   * Absent = no restriction.
   */
  geocode_country?: string;
  /** Name of the currently open world snapshot. Absent until a world is opened. */
  current_world?: string;
  /** 'edit' (default, want tiles draggable) or 'game' (tile positions locked). */
  interaction_mode?: 'edit' | 'game';
  /**
   * The GUI extensions' own settings, keyed by extension name — the canvas's
   * pad is ext.canvas.dpad. The server keeps and merges this without reading
   * it; see utils/ext. Update it with a patch: updateConfig({ ext: {...} }).
   */
  ext?: Record<string, unknown>;
  /** Manual weather effect override for the canvas ('rain'|'storm'|'cloudy'|'snow'|'fog'|'sunny'|''). Empty = auto-detect from want. */
  canvas_weather_effect?: string;
  /** This machine's LAN-reachable address (host only, no scheme/port) — user-confirmed, persisted. "localhost" only works for a browser on the same machine as the mywant server, not a phone on the same Wi-Fi. */
  web_inspector_lan_host?: string;
  /** Server-computed suggestion for web_inspector_lan_host (not persisted — recomputed on every GET). May be wrong if the machine has multiple network interfaces; always let the user confirm/override. */
  detected_lan_ip?: string;
  /** Filesystem path (on the mywant server's machine) to the Caddy internal CA root cert, served at GET /api/v1/web-wants/ca-cert so a phone can download and trust it directly. */
  web_inspector_ca_cert_path?: string;
  /** Public hostname (no scheme/port) that reaches this machine from outside the LAN — e.g. a Cloudflare Tunnel hostname. Unlike web_inspector_lan_host, TLS is terminated at the tunnel provider's edge with a publicly-trusted cert, so no local CA setup is needed. */
  web_inspector_external_host?: string;
  /** Public URL (with scheme, e.g. "https://xxxxx.trycloudflare.com") auto-captured from a cloudflared/ngrok managed_launch want's tunnel_url state field. When present, takes priority over web_inspector_external_host for building the external bookmarklet. */
  tunnel_url?: string;
}
