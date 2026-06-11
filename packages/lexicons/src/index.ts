/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
  Options as XrpcOptions,
  AuthVerifier,
  StreamAuthVerifier,
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
import * as FmTealAlphaStatsGetUserTopReleases from './types/fm/teal/alpha/stats/getUserTopReleases'

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  fm: FmNS
  app: AppNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.fm = new FmNS(this)
    this.app = new AppNS(this)
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

  getProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaActorGetProfile.Handler<ExtractAuth<AV>>,
      FmTealAlphaActorGetProfile.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaActorGetProfiles.Handler<ExtractAuth<AV>>,
      FmTealAlphaActorGetProfiles.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaActorSearchActors.Handler<ExtractAuth<AV>>,
      FmTealAlphaActorSearchActors.HandlerReqCtx<ExtractAuth<AV>>
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

  getActorFeed<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaFeedGetActorFeed.Handler<ExtractAuth<AV>>,
      FmTealAlphaFeedGetActorFeed.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.feed.getActorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPlay<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaFeedGetPlay.Handler<ExtractAuth<AV>>,
      FmTealAlphaFeedGetPlay.HandlerReqCtx<ExtractAuth<AV>>
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

  getFollowers<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaGraphGetFollowers.Handler<ExtractAuth<AV>>,
      FmTealAlphaGraphGetFollowers.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaGraphGetFollows.Handler<ExtractAuth<AV>>,
      FmTealAlphaGraphGetFollows.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSummary<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaGraphGetSummary.Handler<ExtractAuth<AV>>,
      FmTealAlphaGraphGetSummary.HandlerReqCtx<ExtractAuth<AV>>
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

  getAlbum<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaMusicGetAlbum.Handler<ExtractAuth<AV>>,
      FmTealAlphaMusicGetAlbum.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.music.getAlbum' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtist<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaMusicGetArtist.Handler<ExtractAuth<AV>>,
      FmTealAlphaMusicGetArtist.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.music.getArtist' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getArtistListeners<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaMusicGetArtistListeners.Handler<ExtractAuth<AV>>,
      FmTealAlphaMusicGetArtistListeners.HandlerReqCtx<ExtractAuth<AV>>
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

  getResults<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaSearchGetResults.Handler<ExtractAuth<AV>>,
      FmTealAlphaSearchGetResults.HandlerReqCtx<ExtractAuth<AV>>
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

  getLatest<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaStatsGetLatest.Handler<ExtractAuth<AV>>,
      FmTealAlphaStatsGetLatest.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getLatest' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopArtists<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaStatsGetTopArtists.Handler<ExtractAuth<AV>>,
      FmTealAlphaStatsGetTopArtists.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTopReleases<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaStatsGetTopReleases.Handler<ExtractAuth<AV>>,
      FmTealAlphaStatsGetTopReleases.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopArtists<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaStatsGetUserTopArtists.Handler<ExtractAuth<AV>>,
      FmTealAlphaStatsGetUserTopArtists.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getUserTopArtists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUserTopReleases<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      FmTealAlphaStatsGetUserTopReleases.Handler<ExtractAuth<AV>>,
      FmTealAlphaStatsGetUserTopReleases.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'fm.teal.alpha.stats.getUserTopReleases' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
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

type SharedRateLimitOpts<T> = {
  name: string
  calcKey?: (ctx: T) => string | null
  calcPoints?: (ctx: T) => number
}
type RouteRateLimitOpts<T> = {
  durationMs: number
  points: number
  calcKey?: (ctx: T) => string | null
  calcPoints?: (ctx: T) => number
}
type HandlerOpts = { blobLimit?: number }
type HandlerRateLimitOpts<T> = SharedRateLimitOpts<T> | RouteRateLimitOpts<T>
type ConfigOf<Auth, Handler, ReqCtx> =
  | Handler
  | {
      auth?: Auth
      opts?: HandlerOpts
      rateLimit?: HandlerRateLimitOpts<ReqCtx> | HandlerRateLimitOpts<ReqCtx>[]
      handler: Handler
    }
type ExtractAuth<AV extends AuthVerifier | StreamAuthVerifier> = Extract<
  Awaited<ReturnType<AV>>,
  { credentials: unknown }
>
