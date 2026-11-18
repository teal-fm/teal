//! Outbound HTTP for addresses taken from the network: DID documents and PDS
//! endpoints come from records anyone can publish, so a request may only reach
//! public addresses, never follows redirects, and is time-limited.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use anyhow::{anyhow, ensure, Result};
use serde::de::DeserializeOwned;

/// DID documents are a few kilobytes; anything near this is hostile.
const MAX_JSON_BYTES: usize = 256 * 1024;

/// A client that can only reach `url`'s host at the public addresses it
/// resolves to now, so neither a private address nor a later DNS answer
/// (rebinding) can redirect the request.
pub async fn public_client(url: &url::Url, timeout: Duration) -> Result<reqwest::Client> {
    ensure!(url.scheme() == "https", "{url} must use HTTPS");
    let host = url.host_str().ok_or_else(|| anyhow!("{url} has no host"))?;
    ensure!(
        !host.eq_ignore_ascii_case("localhost") && !host.ends_with(".localhost"),
        "{host} is not a public host"
    );

    let port = url.port_or_known_default().unwrap_or(443);
    let addrs: Vec<SocketAddr> =
        tokio::time::timeout(timeout, tokio::net::lookup_host((host, port)))
            .await??
            .collect();
    ensure!(!addrs.is_empty(), "{host} did not resolve");
    ensure!(
        addrs.iter().all(|addr| !is_private_ip(addr.ip())),
        "{host} resolves to a private address"
    );

    Ok(reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout)
        .resolve_to_addrs(host, &addrs)
        .user_agent("teal-cadet (+https://teal.fm)")
        .build()?)
}

/// GETs a small JSON document from a public host.
pub async fn get_public_json<T: DeserializeOwned>(url: &str) -> Result<T> {
    let url = url::Url::parse(url)?;
    let client = public_client(&url, Duration::from_secs(10)).await?;
    let mut response = client.get(url).send().await?.error_for_status()?;
    ensure!(
        response
            .content_length()
            .is_none_or(|length| length <= MAX_JSON_BYTES as u64),
        "response too large"
    );
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        ensure!(
            body.len() + chunk.len() <= MAX_JSON_BYTES,
            "response too large"
        );
        body.extend_from_slice(&chunk);
    }
    Ok(serde_json::from_slice(&body)?)
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_private_ipv4(ip),
        IpAddr::V6(ip) => {
            // ::ffff:a.b.c.d reaches the IPv4 address it embeds.
            ip.to_ipv4_mapped().is_some_and(is_private_ipv4)
                || ip.is_loopback()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
        }
    }
}

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_multicast()
        || ip.is_broadcast()
        // Carrier-grade NAT (100.64.0.0/10) is not publicly routable either.
        || (a == 100 && (64..128).contains(&b))
}

#[cfg(test)]
mod tests {
    use super::is_private_ip;

    #[test]
    fn private_and_mapped_addresses_are_refused() {
        for ip in [
            "10.0.0.1",
            "127.0.0.1",
            "100.100.1.1",
            "::1",
            "::ffff:192.168.1.1",
            "fd00::1",
        ] {
            assert!(is_private_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["1.1.1.1", "2606:4700::1111"] {
            assert!(!is_private_ip(ip.parse().unwrap()), "{ip}");
        }
    }
}
