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
import * as FmTealAlphaActorGetProfile from './types/fm/teal/alpha/actor/getProfile'
import * as FmTealAlphaActorGetProfiles from './types/fm/teal/alpha/actor/getProfiles'
import * as FmTealAlphaActorSearchActors from './types/fm/teal/alpha/actor/searchActors'
import * as FmTealAlphaFeedGetActorFeed from './types/fm/teal/alpha/feed/getActorFeed'
import * as FmTealAlphaFeedGetPlay from './types/fm/teal/alpha/feed/getPlay'
import * as FmTealAlphaGraphGetFollowers from './types/fm/teal/alpha/graph/getFollowers'
import * as FmTealAlphaGraphGetFollows from './types/fm/teal/alpha/graph/getFollows'
import * as FmTealAlphaGraphGetSummary from './types/fm/teal/alpha/graph/getSummary'
import * as FmTealAlphaMusicGetAlbum from './types/fm/teal/alpha/music/getAlbum'
import * as FmTealAlphaMusicGetArtist from './types/fm/teal/alpha/music/getArtist'
import * as FmTealAlphaMusicGetArtistListeners from './types/fm/teal/alpha/music/getArtistListeners'
import * as FmTealAlphaSearchGetResults from './types/fm/teal/alpha/search/getResults'
import * as FmTealAlphaStatsGetLatest from './types/fm/teal/alpha/stats/getLatest'
import * as FmTealAlphaStatsGetTopArtists from './types/fm/teal/alpha/stats/getTopArtists'
import * as FmTealAlphaStatsGetTopReleases from './types/fm/teal/alpha/stats/getTopReleases'
import * as FmTealAlphaStatsGetUserTopArtists from './types/fm/teal/alpha/stats/getUserTopArtists'
import * as FmTealAlphaStatsGetUserTopRecordings from './types/fm/teal/alpha/stats/getUserTopRecordings'
import * as FmTealAlphaStatsGetUserTopReleases from './types/fm/teal/alpha/stats/getUserTopReleases'

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
  alpha: FmTealAlphaNS

  constructor(server: Server) {
    this._server = server
    this.alpha = new FmTealAlphaNS(server)
  }
}

export class FmTealAlphaNS {
  _server: Server
  actor: FmTealAlphaActorNS
  feed: FmTealAlphaFeedNS
  graph: FmTealAlphaGraphNS
  music: FmTealAlphaMusicNS
  richtext: FmTealAlphaRichtextNS
  search: FmTealAlphaSearchNS
  stats: FmTealAlphaStatsNS

  constructor(server: Server) {
    this._server = server
    this.actor = new FmTealAlphaActorNS(server)
    this.feed = new FmTealAlphaFeedNS(server)
    this.graph = new FmTealAlphaGraphNS(server)
    this.music = new FmTealAlphaMusicNS(server)
    this.richtext = new FmTealAlphaRichtextNS(server)
    this.search = new FmTealAlphaSearchNS(server)
    this.stats = new FmTealAlphaStatsNS(server)
  }
}

export class FmTealAlphaActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaActorGetProfile.QueryParams,
      FmTealAlphaActorGetProfile.HandlerInput,
      FmTealAlphaActorGetProfile.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaActorGetProfiles.QueryParams,
      FmTealAlphaActorGetProfiles.HandlerInput,
      FmTealAlphaActorGetProfiles.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaActorSearchActors.QueryParams,
      FmTealAlphaActorSearchActors.HandlerInput,
      FmTealAlphaActorSearchActors.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealAlphaFeedNS {
  _server: Server
  social: FmTealAlphaFeedSocialNS

  constructor(server: Server) {
    this._server = server
    this.social = new FmTealAlphaFeedSocialNS(server)
  }

  getActorFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaFeedGetActorFeed.QueryParams,
      FmTealAlphaFeedGetActorFeed.HandlerInput,
      FmTealAlphaFeedGetActorFeed.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.feed.getActorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPlay<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaFeedGetPlay.QueryParams,
      FmTealAlphaFeedGetPlay.HandlerInput,
      FmTealAlphaFeedGetPlay.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.feed.getPlay' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealAlphaFeedSocialNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FmTealAlphaGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaGraphGetFollowers.QueryParams,
      FmTealAlphaGraphGetFollowers.HandlerInput,
      FmTealAlphaGraphGetFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaGraphGetFollows.QueryParams,
      FmTealAlphaGraphGetFollows.HandlerInput,
      FmTealAlphaGraphGetFollows.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSummary<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaGraphGetSummary.QueryParams,
      FmTealAlphaGraphGetSummary.HandlerInput,
      FmTealAlphaGraphGetSummary.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.graph.getSummary' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealAlphaMusicNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAlbum<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaMusicGetAlbum.QueryParams,
      FmTealAlphaMusicGetAlbum.HandlerInput,
      FmTealAlphaMusicGetAlbum.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.music.getAlbum' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtist<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaMusicGetArtist.QueryParams,
      FmTealAlphaMusicGetArtist.HandlerInput,
      FmTealAlphaMusicGetArtist.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.music.getArtist' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtistListeners<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaMusicGetArtistListeners.QueryParams,
      FmTealAlphaMusicGetArtistListeners.HandlerInput,
      FmTealAlphaMusicGetArtistListeners.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.music.getArtistListeners' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealAlphaRichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FmTealAlphaSearchNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getResults<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaSearchGetResults.QueryParams,
      FmTealAlphaSearchGetResults.HandlerInput,
      FmTealAlphaSearchGetResults.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.search.getResults' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class FmTealAlphaStatsNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getLatest<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetLatest.QueryParams,
      FmTealAlphaStatsGetLatest.HandlerInput,
      FmTealAlphaStatsGetLatest.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getLatest' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopArtists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetTopArtists.QueryParams,
      FmTealAlphaStatsGetTopArtists.HandlerInput,
      FmTealAlphaStatsGetTopArtists.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopReleases<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetTopReleases.QueryParams,
      FmTealAlphaStatsGetTopReleases.HandlerInput,
      FmTealAlphaStatsGetTopReleases.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopArtists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetUserTopArtists.QueryParams,
      FmTealAlphaStatsGetUserTopArtists.HandlerInput,
      FmTealAlphaStatsGetUserTopArtists.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getUserTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopRecordings<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetUserTopRecordings.QueryParams,
      FmTealAlphaStatsGetUserTopRecordings.HandlerInput,
      FmTealAlphaStatsGetUserTopRecordings.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getUserTopRecordings' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopReleases<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      FmTealAlphaStatsGetUserTopReleases.QueryParams,
      FmTealAlphaStatsGetUserTopReleases.HandlerInput,
      FmTealAlphaStatsGetUserTopReleases.HandlerOutput
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getUserTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
