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

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS
  fm: FmNS
  xyz: XyzNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
    this.fm = new FmNS(this)
    this.xyz = new XyzNS(this)
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
  actor: AppBskyActorNS
  richtext: AppBskyRichtextNS

  constructor(server: Server) {
    this._server = server
    this.actor = new AppBskyActorNS(server)
    this.richtext = new AppBskyRichtextNS(server)
  }
}

export class AppBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
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

  constructor(server: Server) {
    this._server = server
    this.actor = new FmTealAlphaActorNS(server)
  }
}

export class FmTealAlphaActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class XyzNS {
  _server: Server
  statusphere: XyzStatusphereNS

  constructor(server: Server) {
    this._server = server
    this.statusphere = new XyzStatusphereNS(server)
  }
}

export class XyzStatusphereNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

type SharedRateLimitOpts<T> = {
  name: string
  calcKey?: (ctx: T) => string
  calcPoints?: (ctx: T) => number
}
type RouteRateLimitOpts<T> = {
  durationMs: number
  points: number
  calcKey?: (ctx: T) => string
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
