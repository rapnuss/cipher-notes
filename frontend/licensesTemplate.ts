import {LicenseInfo} from 'rolldown-license-plugin'

export type LicenseDependency = LicenseInfo & {
  description?: string
  repository?: string
  author?: {
    name?: string
    email?: string
  }
}

export const licensesTemplate = (dependencies: LicenseDependency[]) => `
<html lang="en">
<head>
  <title>Third Party Licenses - ciphernotes</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html {
      font-family: sans-serif;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ccc;
      text-align: left;
      vertical-align: top;
    }
    pre {
      font-size: 0.75rem;
      white-space: pre-wrap;
      width: 80ch;
    }
  </style>
</head>
<body>
  <nav><a href="/">Back to the app</a></nav>
  <h1>Third Party Licenses - ciphernotes</h1>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Version</th>
          <th>License</th>
          <th>Description</th>
          <th>Repository</th>
          <th>Author</th>
          <th>License Copyright</th>
        </tr>
      </thead>
      <tbody>
        ${dependencies
          .map(
            (dep) => `
              <tr>
                <td>${dep.name}</td>
                <td>${dep.version}</td>
                <td>${dep.license}</td>
                <td>${dep.description ?? ''}</td>
                <td>${dep.repository ?? ''}</td>
                <td>${dep.author?.name ?? ''} ${dep.author?.email ?? ''}</td>
                <td><pre>${dep.licenseText?.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></td>
              </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`
