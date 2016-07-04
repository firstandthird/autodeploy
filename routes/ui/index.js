exports.home = {
  path: '/',
  method: 'GET',
  handler(request, reply) {
    reply.redirect('/ui');
  }
};
