export interface OwnedGame {
  appid: number
  name: string
  playtime_forever: number
  img_icon_url: string
}

export async function fetchOwnedGames(): Promise<OwnedGame[]> {
  const key = process.env.STEAM_API_KEY
  const steamId = process.env.STEAM_ID64
  if (!key || !steamId) {
    throw new Error('Missing STEAM_API_KEY or STEAM_ID64 environment variable')
  }

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId}&format=json&include_appinfo=true&include_played_free_games=true`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Steam API request failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.response?.games ?? []) as OwnedGame[]
}
