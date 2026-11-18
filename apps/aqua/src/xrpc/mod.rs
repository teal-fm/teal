pub mod actor;
pub mod feed;
pub mod graph;
pub mod hydrate;
pub mod listening;
pub mod music;
pub mod search;
pub mod social;
pub mod stats;

/// Values of a repeated query parameter (`?actors=a&actors=b`), which XRPC uses
/// for array parameters and `axum::extract::Query` cannot decode into a `Vec`.
pub(crate) fn repeated_param(raw: Option<&str>, key: &str) -> Vec<String> {
    url::form_urlencoded::parse(raw.unwrap_or_default().as_bytes())
        .filter(|(name, value)| name == key && !value.is_empty())
        .map(|(_, value)| value.into_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::repeated_param;

    #[test]
    fn repeated_params_are_collected_in_order() {
        assert_eq!(
            repeated_param(Some("actors=did%3Aplc%3Aa&x=1&actors=bob.test&actors="), "actors"),
            vec!["did:plc:a".to_string(), "bob.test".to_string()]
        );
        assert!(repeated_param(None, "actors").is_empty());
    }
}
