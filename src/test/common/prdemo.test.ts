import * as Octokit from '@octokit/rest';
describe('pull request demo', () => {
	const octokit = new Octokit();
	octokit.authenticate({
		type: 'token',
		token: 'e53a6c04897a4792b33bc27b1857b35377e529f7'
	});
	it('should create a small PR', () => {
		octokit.pullRequests.create({
			base: 'master',
			head: 'rebornix:rebornix/commits',
			body: `Adds the committer's avatar to the tree:

			![screen shot 2018-10-04 at 10 48 25 am](https://user-images.githubusercontent.com/3672607/46494442-c312ab00-c7c7-11e8-9edf-037990323e7d.png)
			`,
			owner: 'RMacfarlane',
			repo: 'vscode-pull-request-github',
			title: 'Add committers avatar to commit tree items'
		}).catch(e => {
			console.log(e);
		});
		// }).then(pr => {
		// 	octokit.issues.addAssigneesToIssue({
		// 		assignees: ['RMacfarlane'],
		// 		number: pr.data.number,
		// 		owner: 'RMacfarlane',
		// 		repo: 'vscode-pull-request-github'
		// 	});
		// }).catch(e => {
		// 	console.log(e);
		// });
	});
});