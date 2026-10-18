//! Explicit navigation to the pet catalog's public source pages.

pub fn checked_url(value: &str) -> Result<String, String> {
    let denied = || "This pet reference link is not allowed".to_string();
    if value.len() > 800 || value.chars().any(char::is_control) {
        return Err(denied());
    }
    let url = reqwest::Url::parse(value).map_err(|_| denied())?;
    if url.scheme() != "https"
        || !matches!(url.host_str(), Some("metabot.gg" | "www.metabot.gg"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return Err(denied());
    }
    let path: Vec<_> = url.path_segments().ok_or_else(denied)?.collect();
    if path.len() != 4
        || path[0] != "en"
        || path[1] != "aion-2"
        || !matches!(path[2], "mounts" | "map")
        || path[3].is_empty()
        || !path[3]
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(denied());
    }
    if let Some(query) = url.query() {
        let pairs: Vec<_> = url.query_pairs().collect();
        if path[2] != "map" || query.is_empty() || pairs.len() != 1 || pairs[0].0 != "focus" {
            return Err(denied());
        }
        let npc = pairs[0].1.strip_prefix("npc:").ok_or_else(denied)?;
        if npc.is_empty() || npc.len() > 20 || !npc.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(denied());
        }
    }
    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_only_known_public_pet_pages_and_npc_map_queries() {
        for url in [
            "https://metabot.gg/en/aion-2/mounts/krall-laborer",
            "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075",
            "https://www.metabot.gg/en/aion-2/map/altgard",
        ] {
            assert!(checked_url(url).is_ok(), "{url}");
        }
    }

    #[test]
    fn rejects_protocol_host_path_query_and_control_injection() {
        for url in [
            "file:///C:/Windows/System32/cmd.exe",
            "javascript:alert(1)",
            "http://metabot.gg/en/aion-2/mounts/krall-laborer",
            "https://metabot.gg.evil.test/en/aion-2/mounts/krall-laborer",
            "https://metabot.gg@evil.test/en/aion-2/mounts/krall-laborer",
            "https://name@metabot.gg/en/aion-2/mounts/krall-laborer",
            "https://metabot.gg:8443/en/aion-2/mounts/krall-laborer",
            "https://metabot.gg/en/aion-2/account/settings",
            "https://metabot.gg/en/aion-2/mounts/krall-laborer?redirect=https://evil.test",
            "https://metabot.gg/en/aion-2/map/verteron?focus=npc:1&redirect=x",
            "https://metabot.gg/en/aion-2/map/verteron?focus=player:1",
            "https://metabot.gg/en/aion-2/map/verteron?focus=npc:1#token",
            "https://metabot.gg/en/aion-2/mounts/%22.exe",
            "https://metabot.gg/en/aion-2/mounts/k\nral",
        ] {
            assert!(checked_url(url).is_err(), "{url}");
        }
    }
}
