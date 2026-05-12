import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, GitCommit, ExternalLink } from "lucide-react";

/**
 * GitHub-Repo Konfiguration.
 * Trage hier owner/repo/branch deines verbundenen GitHub-Repositories ein.
 * Funktioniert out-of-the-box für PUBLIC repos (kein Token nötig).
 * Für private Repos müsste eine Edge Function mit GITHUB_TOKEN ergänzt werden.
 */
const GITHUB_OWNER = "OWNER";   // z.B. "ceram-rox"
const GITHUB_REPO = "REPO";     // z.B. "ceram-rox-app"
const GITHUB_BRANCH = "main";

interface CommitInfo {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

export function GitHubCommitStatus() {
  const configured =
    GITHUB_OWNER !== "OWNER" && GITHUB_REPO !== "REPO";

  const { data, isLoading, error } = useQuery<CommitInfo>({
    queryKey: ["github-commit", GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH],
    enabled: configured,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      return res.json();
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          GitHub-Status
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!configured && (
          <p className="text-muted-foreground">
            Repo nicht konfiguriert. Trage <code>GITHUB_OWNER</code> und{" "}
            <code>GITHUB_REPO</code> in{" "}
            <code>src/components/GitHubCommitStatus.tsx</code> ein.
          </p>
        )}
        {configured && isLoading && (
          <p className="text-muted-foreground">Lade Commit-Info…</p>
        )}
        {configured && error && (
          <p className="text-destructive">
            Fehler beim Laden: {(error as Error).message}
          </p>
        )}
        {configured && data && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                <GitBranch className="mr-1 h-3 w-3" />
                {GITHUB_BRANCH}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                <GitCommit className="mr-1 h-3 w-3" />
                {data.sha.substring(0, 7)}
              </Badge>
            </div>
            <p className="font-medium line-clamp-2">
              {data.commit.message.split("\n")[0]}
            </p>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>
                {data.commit.author.name} •{" "}
                {new Date(data.commit.author.date).toLocaleString("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <a
                href={data.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                Öffnen <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
