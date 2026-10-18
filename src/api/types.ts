export interface Credentials {
  serverUrl: string;
  username: string;
  token: string;
  salt: string;
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  year?: number;
  songCount?: number;
  duration?: number;
  coverArt?: string;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  albumId?: string;
  artist?: string;
  track?: number;
  discNumber?: number;
  duration?: number;
  coverArt?: string;
  suffix?: string;
  bitRate?: number;
}

export interface AlbumWithSongs extends Album {
  song?: Song[];
}

export type AlbumListType =
  | "newest"
  | "recent"
  | "frequent"
  | "random"
  | "alphabeticalByName"
  | "alphabeticalByArtist"
  | "starred"
  | "byYear";
