/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons'
import * as FmTealActorGetProfile from './types/fm/teal/actor/getProfile'
import * as FmTealActorGetProfiles from './types/fm/teal/actor/getProfiles'
import * as FmTealActorSearchActors from './types/fm/teal/actor/searchActors'
import * as FmTealFeedGetActorFeed from './types/fm/teal/feed/getActorFeed'
import * as FmTealFeedGetPlay from './types/fm/teal/feed/getPlay'
import * as FmTealGraphGetFollowers from './types/fm/teal/graph/getFollowers'
import * as FmTealGraphGetFollows from './types/fm/teal/graph/getFollows'
import * as FmTealGraphGetSummary from './types/fm/teal/graph/getSummary'
import * as FmTealMusicGetAlbum from './types/fm/teal/music/getAlbum'
import * as FmTealMusicGetArtist from './types/fm/teal/music/getArtist'
import * as FmTealMusicGetArtistListeners from './types/fm/teal/music/getArtistListeners'
import * as FmTealSearchGetResults from './types/fm/teal/search/getResults'
import * as FmTealStatsGetLatest from './types/fm/teal/stats/getLatest'
import * as FmTealStatsGetTopArtists from './types/fm/teal/stats/getTopArtists'
import * as FmTealStatsGetTopReleases from './types/fm/teal/stats/getTopReleases'
import * as FmTealStatsGetUserTopArtists from './types/fm/teal/stats/getUserTopArtists'
import * as FmTealStatsGetUserTopRecordings from './types/fm/teal/stats/getUserTopRecordings'
import * as FmTealStatsGetUserTopReleases from './types/fm/teal/stats/getUserTopReleases'

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS
  fm: FmNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
    this.fm = new FmNS(this)
  }
}

export class AppNS {
  _server: Server
  bsky: AppBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new AppBskyNS(server)
  }
}

export class AppBskyNS {
  _server: Server
  richtext: AppBskyRichtextNS

  constructor(server: Server) {
    this._server = server
    this.richtext = new AppBskyRichtextNS(server)
  }
}

export class AppBskyRichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FmNS {
  _server: Server
  teal: FmTealNS

  constructor(server: Server) {
    this._server = server
    this.teal = new FmTealNS(server)
  }
}

export class FmTealNS {
  _server: Server
  actor: FmTealActorNS
  feed: FmTealFeedNS
  graph: FmTealGraphNS
  music: FmTealMusicNS
  richtext: FmTealRichtextNS
  search: FmTealSearchNS
  stats: FmTealStatsNS

  constructor(server: Server) {
    this._server = server
    this.actor = new FmTealActorNS(server)
    this.feed = new FmTealFeedNS(server)
    this.graph = new FmTealGraphNS(server)
    this.music = new FmTealMusicNS(server)
    this.richtext = new FmTealRichtextNS(server)
    this.search = new FmTealSearchNS(server)
    this.stats = new FmTealStatsNS(server)
  }
}

export class FmTealActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealActorGetProfile.QueryParams,
      FmTealActorGetProfile.HandlerInput,
      FmTealActorGetProfile.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealActorGetProfiles.QueryParams,
      FmTealActorGetProfiles.HandlerInput,
      FmTealActorGetProfiles.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealActorSearchActors.QueryParams,
      FmTealActorSearchActors.HandlerInput,
      FmTealActorSearchActors.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealFeedNS {
  _server: Server
  social: FmTealFeedSocialNS

  constructor(server: Server) {
    this._server = server
    this.social = new FmTealFeedSocialNS(server)
  }

  getActorFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealFeedGetActorFeed.QueryParams,
      FmTealFeedGetActorFeed.HandlerInput,
      FmTealFeedGetActorFeed.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.feed.getActorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPlay<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealFeedGetPlay.QueryParams,
      FmTealFeedGetPlay.HandlerInput,
      FmTealFeedGetPlay.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.feed.getPlay' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealFeedSocialNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FmTealGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealGraphGetFollowers.QueryParams,
      FmTealGraphGetFollowers.HandlerInput,
      FmTealGraphGetFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealGraphGetFollows.QueryParams,
      FmTealGraphGetFollows.HandlerInput,
      FmTealGraphGetFollows.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSummary<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealGraphGetSummary.QueryParams,
      FmTealGraphGetSummary.HandlerInput,
      FmTealGraphGetSummary.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.graph.getSummary' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealMusicNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAlbum<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealMusicGetAlbum.QueryParams,
      FmTealMusicGetAlbum.HandlerInput,
      FmTealMusicGetAlbum.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.music.getAlbum' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtist<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealMusicGetArtist.QueryParams,
      FmTealMusicGetArtist.HandlerInput,
      FmTealMusicGetArtist.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.music.getArtist' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtistListeners<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealMusicGetArtistListeners.QueryParams,
      FmTealMusicGetArtistListeners.HandlerInput,
      FmTealMusicGetArtistListeners.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.music.getArtistListeners' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealRichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FmTealSearchNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getResults<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealSearchGetResults.QueryParams,
      FmTealSearchGetResults.HandlerInput,
      FmTealSearchGetResults.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.search.getResults' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealStatsNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getLatest<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetLatest.QueryParams,
      FmTealStatsGetLatest.HandlerInput,
      FmTealStatsGetLatest.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getLatest' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopArtists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetTopArtists.QueryParams,
      FmTealStatsGetTopArtists.HandlerInput,
      FmTealStatsGetTopArtists.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopReleases<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetTopReleases.QueryParams,
      FmTealStatsGetTopReleases.HandlerInput,
      FmTealStatsGetTopReleases.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopArtists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetUserTopArtists.QueryParams,
      FmTealStatsGetUserTopArtists.HandlerInput,
      FmTealStatsGetUserTopArtists.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getUserTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopRecordings<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetUserTopRecordings.QueryParams,
      FmTealStatsGetUserTopRecordings.HandlerInput,
      FmTealStatsGetUserTopRecordings.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getUserTopRecordings' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopReleases<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealStatsGetUserTopReleases.QueryParams,
      FmTealStatsGetUserTopReleases.HandlerInput,
      FmTealStatsGetUserTopReleases.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.stats.getUserTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
