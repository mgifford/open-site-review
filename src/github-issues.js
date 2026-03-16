function extractUrls(text) {
  if (!text) {
    return [];
  }

  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const deduped = new Set(matches.map((url) => url.trim()));
  return [...deduped];
}

function parseIssueReference(input) {
  if (!input) {
    throw new Error("Missing issue reference.");
  }

  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:[/?#].*)?$/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      issueNumber: Number(urlMatch[3])
    };
  }

  const shortMatch = trimmed.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      issueNumber: Number(shortMatch[3])
    };
  }

  throw new Error(
    "Issue reference must be a GitHub issue URL or owner/repo#number."
  );
}

async function fetchIssueIssueBody(issueRef, token) {
  const { owner, repo, issueNumber } = parseIssueReference(issueRef);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

  const headers = {
    "user-agent": "open-site-review/0.3",
    accept: "application/vnd.github+json"
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, { headers });
  if (!response.ok) {
    throw new Error(`Could not fetch issue ${issueRef}: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    owner,
    repo,
    issueNumber,
    body: data.body || "",
    title: data.title || ""
  };
}

async function resolveUrlsFromIssue(issueRef, token) {
  const issue = await fetchIssueIssueBody(issueRef, token);
  const urls = extractUrls(issue.body);

  return {
    issue,
    urls
  };
}

module.exports = {
  resolveUrlsFromIssue
};
